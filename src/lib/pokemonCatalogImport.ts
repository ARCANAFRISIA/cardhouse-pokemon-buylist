import { prisma } from "@/lib/prisma";
import { cardmarketGetJson } from "@/lib/cardmarketClient";
import {
  fetchPokemonTcgCardsForSet,
  fetchPokemonTcgSets,
  type PokemonTcgCard,
  type PokemonTcgSet,
} from "@/lib/pokemonTcgApi";

export type PokemonCatalogExpansion = {
  idExpansion: number;
  enName: string | null;
  abbreviation: string | null;
  releaseDate: string | null;
  isReleased: boolean | null;
};

export type PokemonCatalogProduct = {
  idExpansion: number;
  idProduct: number;
  idMetaproduct: number | null;
  enName: string | null;
  locName: string | null;
  website: string | null;
  image: string | null;
  categoryName: string | null;
  expansionName: string | null;
  number: string | null;
  rarity: string | null;
};

type MatchedExpansion = {
  expansion: PokemonCatalogExpansion;
  tcgSet: PokemonTcgSet;
};

export type PokemonCatalogImportResult = {
  ok: boolean;
  dryRun: boolean;
  batchId: string | null;
  expansionCount: number;
  requestedExpansionIds: number[];
  fetchedProducts: number;
  eligibleProducts: number;
  upsertedCards: number;
  skippedInvalid: number;
  skippedRarity: number;
  skippedLanguage: number;
  skippedExpansionLanguage: number;
  skippedNoEnglishTcgSet: number;
  skippedNoTcgCardMatch: number;
  matchedEnglishSetCount: number;
  errors: Array<{ idExpansion: number; name: string | null; error: string }>;
};

const MODERN_CUTOFF = new Date("2019-11-15T00:00:00+01:00").getTime();
const FUTURE_RELEASE_GRACE_DAYS = 7;

function latestAllowedReleaseTimestamp() {
  return Date.now() + FUTURE_RELEASE_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

const ALLOWED_TCG_SERIES = new Set([
  "Sword & Shield",
  "Scarlet & Violet",
  "Mega Evolution",
]);

const NON_ENGLISH_ABBR_TOKEN_PATTERN =
  /(^|[^A-Z0-9])(J|JP|JPN|C|CN|CHS|CHT|K|KR|KO|TH|THA|ID|INA)([^A-Z0-9]|$)/i;

const BLOCKED_SET_NAME_PARTS = [
  "additionals",
  "gem pack",
  "terastal gathering",
  "battle partners",
  "heat wave arena",
  "hot wind arena",
  "glory of team rocket",
  "the glory of team rocket",
  "world championship",
  "world championships",
  "world championship deck",
  "wcd 2025",
  "abyss eye",
  "mega brave",
  "mega symphonia",
  "black bolt white flare",
  "white flare black bolt",
  "japanese",
  "japan",
  "chinese",
  "simplified chinese",
  "traditional chinese",
  "korean",
  "thai",
  "indonesian",
  "asia",
  "asian",
  "hong kong",
  "taiwan",
];

const BLOCKED_SET_CODE_PREFIXES = [
  "CSV",
  "CSVF",
  "CSVG",
  "CSVC",
  "XCR",
  "CRB",
  "CBB",
  "CMB",
  "WCD",
];

const BLOCKED_RARITIES = new Set([
  "",
  "common",
  "uncommon",
  "rare",
  "holo rare",
  "rare holo",
]);

const ALLOWED_RARITY_PARTS = [
  "amazing rare",
  "ace spec rare",
  "double rare",
  "hyper rare",
  "illustration rare",
  "promo",
  "radiant rare",
  "rare holo ex",
  "rare holo gx",
  "rare holo lv x",
  "rare holo v",
  "rare holo vmax",
  "rare holo vstar",
  "secret rare",
  "shiny rare",
  "shiny ultra rare",
  "special illustration rare",
  "trainer gallery rare holo",
  "ultra rare",
];

function hasCjkCharacters(value: string | null | undefined) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(value ?? ""));
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function fixEncoding(value: string | null) {
  if (!value) return value;

  // Cardmarket sometimes returns mojibake in older endpoints.
  // Do not touch already-correct UTF-8 text like Pokémon, Flabébé, etc.
  if (!/[ÃÂ]/.test(value)) return value;

  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/lv\.x/gi, "lv x")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSetName(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/^pokemon /, "")
    .replace(/ pokemon$/, "")
    .replace(/ trading card game /g, " ")
    .replace(/ tcg /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUpper(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeSetCode(value: string | null | undefined) {
  return normalizeUpper(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeCollectorNumber(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.replace(/^0+(\d)/, "$1");
}

function makeCardKey(input: {
  cardmarketId: number;
  language: string;
  condition: string;
  finishType: string;
}) {
  return [
    input.cardmarketId,
    normalizeUpper(input.language),
    normalizeUpper(input.condition),
    normalizeUpper(input.finishType),
  ].join("|");
}

function pickExpansionArray(obj: any): any[] {
  if (Array.isArray(obj?.expansion)) return obj.expansion;
  if (Array.isArray(obj?.expansions)) return obj.expansions;
  if (Array.isArray(obj?.response?.expansion)) return obj.response.expansion;
  if (Array.isArray(obj?.response?.expansions)) return obj.response.expansions;
  return [];
}

function pickProductArray(obj: any): any[] {
  if (Array.isArray(obj?.single)) return obj.single;
  if (Array.isArray(obj?.singles)) return obj.singles;
  if (Array.isArray(obj?.product)) return obj.product;
  if (Array.isArray(obj?.products)) return obj.products;
  if (Array.isArray(obj?.expansion?.single)) return obj.expansion.single;
  if (Array.isArray(obj?.expansion?.singles)) return obj.expansion.singles;
  if (Array.isArray(obj?.expansion?.product)) return obj.expansion.product;
  if (Array.isArray(obj?.expansion?.products)) return obj.expansion.products;
  if (Array.isArray(obj?.response?.single)) return obj.response.single;
  if (Array.isArray(obj?.response?.singles)) return obj.response.singles;
  if (Array.isArray(obj?.response?.product)) return obj.response.product;
  if (Array.isArray(obj?.response?.products)) return obj.response.products;
  return [];
}

function parseExpansion(raw: any): PokemonCatalogExpansion | null {
  const idExpansion = toNumber(raw?.idExpansion);
  if (!idExpansion || idExpansion <= 0) return null;

  return {
    idExpansion,
    enName: fixEncoding(toStringOrNull(raw?.enName ?? raw?.name?.en ?? raw?.name)),
    abbreviation: fixEncoding(toStringOrNull(raw?.abbreviation)),
    releaseDate: toStringOrNull(raw?.releaseDate),
    isReleased:
      typeof raw?.isReleased === "boolean"
        ? raw.isReleased
        : raw?.isReleased == null
        ? null
        : String(raw.isReleased).toLowerCase() === "true",
  };
}

function parseProduct(raw: any, idExpansion: number): PokemonCatalogProduct | null {
  const idProduct = toNumber(raw?.idProduct);
  if (!idProduct || idProduct <= 0) return null;

  return {
    idExpansion,
    idProduct,
    idMetaproduct: toNumber(raw?.idMetaproduct),
    enName: fixEncoding(toStringOrNull(raw?.enName)),
    locName: fixEncoding(toStringOrNull(raw?.locName)),
    website: toStringOrNull(raw?.website),
    image: toStringOrNull(raw?.image),
    categoryName: fixEncoding(toStringOrNull(raw?.categoryName)),
    expansionName: fixEncoding(toStringOrNull(raw?.expansionName)),
    number: toStringOrNull(raw?.number),
    rarity: fixEncoding(toStringOrNull(raw?.rarity)),
  };
}

function isModernExpansion(expansion: PokemonCatalogExpansion) {
  if (!expansion.releaseDate) return false;
  if (expansion.isReleased === false) return false;

  const timestamp = new Date(expansion.releaseDate).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp >= MODERN_CUTOFF &&
    timestamp <= latestAllowedReleaseTimestamp()
  );
}

function tcgDateToTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const normalized = value.replace(/\//g, "-");
  const timestamp = new Date(`${normalized}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isAllowedEnglishTcgSet(set: PokemonTcgSet) {
  if (!set.name) return false;
  if (!set.series || !ALLOWED_TCG_SERIES.has(set.series)) return false;

  const timestamp = tcgDateToTimestamp(set.releaseDate);
  if (!timestamp || timestamp < MODERN_CUTOFF) return false;
  if (timestamp > latestAllowedReleaseTimestamp()) return false;

  if (isClearlyNonEnglishCardmarketSet({ setName: set.name, setCode: set.ptcgoCode })) {
    return false;
  }

  return true;
}

export function isClearlyNonEnglishCardmarketSet(input: {
  setName?: string | null;
  setCode?: string | null;
  name?: string | null;
}) {
  const setName = normalizeSetName(input.setName);
  const setCode = normalizeSetCode(input.setCode);

  if (hasCjkCharacters(input.name) || hasCjkCharacters(input.setName)) return true;

  if (BLOCKED_SET_NAME_PARTS.some((part) => setName.includes(part))) {
    return true;
  }

  if (NON_ENGLISH_ABBR_TOKEN_PATTERN.test(normalizeUpper(input.setCode))) {
    return true;
  }

  if (BLOCKED_SET_CODE_PREFIXES.some((prefix) => setCode.startsWith(prefix))) {
    return true;
  }

  // Most current English era set codes are 2-4 chars, e.g. DRI/PAR/SVP/SWSH/SV.
  // Codes like CRB5C and CSV9.5C are Asian product lines in Cardmarket's Pokémon game.
  if (/C$/.test(setCode) && setCode.length >= 5) {
    return true;
  }

  // Lowercase/short m-codes such as m5/Abyss Eye are Japanese product lines,
  // even when Cardmarket/PowerTools lets us export them with language English.
  if (/^M\d+$/.test(setCode)) {
    return true;
  }

  return false;
}

function buildTcgUniverse(sets: PokemonTcgSet[]) {
  const eligibleSets = sets.filter(isAllowedEnglishTcgSet);
  const byCode = new Map<string, PokemonTcgSet>();
  const byName = new Map<string, PokemonTcgSet>();

  for (const set of eligibleSets) {
    const code = normalizeSetCode(set.ptcgoCode ?? set.id);
    if (code) byCode.set(code, set);

    // Pokémon TCG API IDs are useful fallback aliases: swsh1, sv1, etc.
    const idCode = normalizeSetCode(set.id);
    if (idCode) byCode.set(idCode, set);

    const name = normalizeSetName(set.name);
    if (name) byName.set(name, set);
  }

  return {
    eligibleSets,
    byCode,
    byName,
  };
}

function matchCardmarketExpansionToTcgSet(
  expansion: PokemonCatalogExpansion,
  universe: ReturnType<typeof buildTcgUniverse>
) {
  if (
    isClearlyNonEnglishCardmarketSet({
      setName: expansion.enName,
      setCode: expansion.abbreviation,
    })
  ) {
    return null;
  }

  const cmCode = normalizeSetCode(expansion.abbreviation);
  const codeMatch = cmCode ? universe.byCode.get(cmCode) : null;
  if (codeMatch) return codeMatch;

  const cmName = normalizeSetName(expansion.enName);
  const nameMatch = cmName ? universe.byName.get(cmName) : null;
  if (nameMatch) return nameMatch;

  return null;
}

function isBuylistRarity(rarity: string | null | undefined) {
  const normalized = normalizeText(rarity);

  if (BLOCKED_RARITIES.has(normalized)) return false;

  return ALLOWED_RARITY_PARTS.some((part) => normalized.includes(part));
}

function normalizeImageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function buildTcgCardMap(cards: PokemonTcgCard[]) {
  const byNumberName = new Map<string, PokemonTcgCard>();
  const byNumber = new Map<string, PokemonTcgCard[]>();

  for (const card of cards) {
    const number = normalizeCollectorNumber(card.number);
    if (!number) continue;

    const name = normalizeText(card.name);
    byNumberName.set(`${number}|${name}`, card);

    const existing = byNumber.get(number) ?? [];
    existing.push(card);
    byNumber.set(number, existing);
  }

  return { byNumberName, byNumber };
}

function findTcgCardForProduct(
  product: PokemonCatalogProduct,
  map: ReturnType<typeof buildTcgCardMap>
) {
  const number = normalizeCollectorNumber(product.number);
  if (!number) return null;

  const name = normalizeText(product.enName ?? product.locName);
  const exact = map.byNumberName.get(`${number}|${name}`);
  if (exact) return exact;

  const candidates = map.byNumber.get(number) ?? [];
  if (candidates.length === 1) return candidates[0];

  return null;
}

export function isEnglishPokemonCatalogCard(input: {
  name?: string | null;
  setName?: string | null;
  setCode?: string | null;
}) {
  return !isClearlyNonEnglishCardmarketSet(input);
}

export async function fetchPokemonCardmarketExpansions() {
  const { data } = await cardmarketGetJson<any>("/games/6/expansions");
  const raw = pickExpansionArray(data);

  return raw
    .map(parseExpansion)
    .filter((row): row is PokemonCatalogExpansion => row !== null);
}

export async function fetchPokemonCardmarketSingles(idExpansion: number) {
  const { data } = await cardmarketGetJson<any>(`/expansions/${idExpansion}/singles`);
  const raw = pickProductArray(data);

  return raw
    .map((row) => parseProduct(row, idExpansion))
    .filter((row): row is PokemonCatalogProduct => row !== null);
}

export async function importPokemonCatalogFromCardmarket(input?: {
  expansionIds?: number[];
  limitExpansions?: number;
  dryRun?: boolean;
}): Promise<PokemonCatalogImportResult> {
  const dryRun = input?.dryRun === true;

  const [expansions, tcgSets] = await Promise.all([
    fetchPokemonCardmarketExpansions(),
    fetchPokemonTcgSets(),
  ]);

  const tcgUniverse = buildTcgUniverse(tcgSets);
  const expansionMap = new Map(expansions.map((expansion) => [expansion.idExpansion, expansion]));

  const modernExpansions = expansions
    .filter(isModernExpansion)
    .sort((a, b) => {
      const ta = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const tb = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return tb - ta;
    });

  const matchedModernExpansions: MatchedExpansion[] = modernExpansions
    .map((expansion) => {
      const tcgSet = matchCardmarketExpansionToTcgSet(expansion, tcgUniverse);
      return tcgSet ? { expansion, tcgSet } : null;
    })
    .filter((row): row is MatchedExpansion => row !== null);

  const requestedTargetExpansions: MatchedExpansion[] = input?.expansionIds?.length
    ? input.expansionIds
        .map((id) => expansionMap.get(id))
        .filter((expansion): expansion is PokemonCatalogExpansion => !!expansion)
        .map((expansion) => {
          const tcgSet = matchCardmarketExpansionToTcgSet(expansion, tcgUniverse);
          return tcgSet ? { expansion, tcgSet } : null;
        })
        .filter((row): row is MatchedExpansion => row !== null)
    : matchedModernExpansions.slice(0, Math.max(1, input?.limitExpansions ?? 10));

  const explicitRequestedCount = input?.expansionIds?.length ?? 0;
  const skippedNoEnglishTcgSet = explicitRequestedCount
    ? Math.max(0, explicitRequestedCount - requestedTargetExpansions.length)
    : Math.max(0, modernExpansions.length - matchedModernExpansions.length);

  const batch = dryRun
    ? null
    : await prisma.importBatch.create({
        data: {
          type: "CARDMARKET_CATALOG_IMPORT",
          rowCount: 0,
          success: false,
          message: "Import started",
        },
      });

  const result: PokemonCatalogImportResult = {
    ok: false,
    dryRun,
    batchId: batch?.id ?? null,
    expansionCount: requestedTargetExpansions.length,
    requestedExpansionIds: requestedTargetExpansions.map((row) => row.expansion.idExpansion),
    fetchedProducts: 0,
    eligibleProducts: 0,
    upsertedCards: 0,
    skippedInvalid: 0,
    skippedRarity: 0,
    skippedLanguage: 0,
    skippedExpansionLanguage: 0,
    skippedNoEnglishTcgSet,
    skippedNoTcgCardMatch: 0,
    matchedEnglishSetCount: matchedModernExpansions.length,
    errors: [],
  };

  try {
    for (const { expansion, tcgSet } of requestedTargetExpansions) {
      let products: PokemonCatalogProduct[] = [];
      let tcgCards: PokemonTcgCard[] = [];

      try {
        products = await fetchPokemonCardmarketSingles(expansion.idExpansion);
        result.fetchedProducts += products.length;
      } catch (error: any) {
        result.errors.push({
          idExpansion: expansion.idExpansion,
          name: expansion.enName,
          error: error?.message ?? "Failed to fetch Cardmarket singles",
        });
        continue;
      }

      try {
        tcgCards = await fetchPokemonTcgCardsForSet(tcgSet.id);
      } catch (error: any) {
        // Some official English Pokémon TCG sets are visible in /sets before
        // their full card list is available. Treat those as not importable yet
        // instead of failing the whole dry run/import.
        result.skippedNoTcgCardMatch += products.length;
        continue;
      }

      if (tcgCards.length === 0) {
        result.skippedNoTcgCardMatch += products.length;
        continue;
      }

      const tcgCardMap = buildTcgCardMap(tcgCards);

      for (const product of products) {
        const cardmarketId = product.idProduct;
        const name = product.enName ?? product.locName;
        const setName = product.expansionName ?? expansion.enName ?? tcgSet.name;
        const collectorNumber = normalizeCollectorNumber(product.number);
        const rarity = product.rarity;

        if (!cardmarketId || !name || !setName || !collectorNumber) {
          result.skippedInvalid++;
          continue;
        }

        if (
          hasCjkCharacters(name) ||
          hasCjkCharacters(product.locName) ||
          isClearlyNonEnglishCardmarketSet({ name, setName, setCode: expansion.abbreviation })
        ) {
          result.skippedLanguage++;
          continue;
        }

        const matchedTcgCard = findTcgCardForProduct(product, tcgCardMap);

        // Important safety check: Cardmarket can expose Japanese/Asian product lines
        // with English product names and an English language flag in PowerTools.
        // We only keep products that can be matched to an official English TCG API
        // card in the matched English set by collector number/name.
        if (!matchedTcgCard) {
          result.skippedNoTcgCardMatch++;
          continue;
        }

        if (!isBuylistRarity(rarity)) {
          result.skippedRarity++;
          continue;
        }

        const tcgImage = matchedTcgCard.images?.small ?? matchedTcgCard.images?.large ?? null;

        result.eligibleProducts++;

        const language = "English";
        const condition = "NM";
        const finishType = "Regular";
        const cardKey = makeCardKey({
          cardmarketId,
          language,
          condition,
          finishType,
        });

        if (dryRun) continue;

        await prisma.pokemonCard.upsert({
          where: { cardKey },
          create: {
            cardKey,
            cardmarketId,
            name,
            setName,
            setCode: expansion.abbreviation ?? tcgSet.ptcgoCode ?? tcgSet.id,
            collectorNumber,
            rarity,
            series: tcgSet.series ?? null,
            language,
            condition,
            finishType,
            imageUrl: normalizeImageUrl(tcgImage),
            active: true,
          },
          update: {
            name,
            setName,
            setCode: expansion.abbreviation ?? tcgSet.ptcgoCode ?? tcgSet.id,
            collectorNumber,
            rarity,
            series: tcgSet.series ?? null,
            language,
            condition,
            finishType,
            imageUrl: normalizeImageUrl(tcgImage),
            active: true,
          },
        });

        result.upsertedCards++;
      }
    }

    result.ok = result.errors.length === 0;

    if (batch) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          rowCount: result.fetchedProducts,
          success: result.ok,
          message: `Catalog import: ${result.upsertedCards} upserted, ${result.skippedRarity} skipped by rarity, ${result.skippedLanguage} skipped by language/set, ${result.skippedNoEnglishTcgSet} skipped no official English TCG set, ${result.skippedNoTcgCardMatch} skipped no matching English TCG card, ${result.skippedInvalid} invalid, ${result.errors.length} expansion errors`,
        },
      });
    }

    return result;
  } catch (error: any) {
    if (batch) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          rowCount: result.fetchedProducts,
          success: false,
          message: error?.message ?? "Catalog import failed",
        },
      });
    }

    throw error;
  }
}

export async function getPokemonCatalogStats() {
  const [totalCards, activeCards, inactiveCards, pricedCards, currentPriceRows, recentBatches] =
    await Promise.all([
      prisma.pokemonCard.count(),
      prisma.pokemonCard.count({ where: { active: true } }),
      prisma.pokemonCard.count({ where: { active: false } }),
      prisma.pokemonCard.count({ where: { prices: { some: { isCurrent: true } } } }),
      prisma.pokemonPrice.count({ where: { isCurrent: true } }),
      prisma.importBatch.findMany({
        where: {
          type: {
            in: ["CARDMARKET_CATALOG_IMPORT", "POWERTOOLS_EXPORT"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

  return {
    totalCards,
    activeCards,
    inactiveCards,
    pricedCards,
    unpricedCards: Math.max(0, totalCards - pricedCards),
    currentPriceRows,
    recentBatches,
  };
}
