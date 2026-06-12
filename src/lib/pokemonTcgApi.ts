import { prisma } from "@/lib/prisma";

export type PokemonTcgSet = {
  id: string;
  name: string;
  series: string | null;
  ptcgoCode: string | null;
  releaseDate: string | null;
  images?: {
    symbol?: string;
    logo?: string;
  } | null;
};

export type PokemonTcgCard = {
  id: string;
  name: string;
  number: string | null;
  rarity: string | null;
  images?: {
    small?: string;
    large?: string;
  } | null;
  set?: PokemonTcgSet | null;
};

type PokemonTcgListResponse<T> = {
  data?: T[];
  page?: number;
  pageSize?: number;
  count?: number;
  totalCount?: number;
};

type CachedTcgSets = {
  savedAt: string;
  sets: PokemonTcgSet[];
};

const BASE_URL = "https://api.pokemontcg.io/v2";
const DEFAULT_PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 18_000;
const MAX_RETRIES = 2;
const SET_CACHE_KEY = "pokemonTcgSetsCacheJson";
const SET_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Emergency fallback so a temporary Pokémon TCG/Scrydex Cloudflare 504 does not
// block the Cardmarket catalog import entirely. This does not contain card data;
// card data is still fetched live per matched set before any Cardmarket product
// is accepted into the catalog.
const FALLBACK_TCG_SETS: PokemonTcgSet[] = [
  { id: "swsh1", name: "Sword & Shield", series: "Sword & Shield", ptcgoCode: "SSH", releaseDate: "2020/02/07" },
  { id: "swsh2", name: "Rebel Clash", series: "Sword & Shield", ptcgoCode: "RCL", releaseDate: "2020/05/01" },
  { id: "swsh3", name: "Darkness Ablaze", series: "Sword & Shield", ptcgoCode: "DAA", releaseDate: "2020/08/14" },
  { id: "swsh35", name: "Champion's Path", series: "Sword & Shield", ptcgoCode: "CPA", releaseDate: "2020/09/25" },
  { id: "swsh4", name: "Vivid Voltage", series: "Sword & Shield", ptcgoCode: "VIV", releaseDate: "2020/11/13" },
  { id: "swsh45", name: "Shining Fates", series: "Sword & Shield", ptcgoCode: "SHF", releaseDate: "2021/02/19" },
  { id: "swsh5", name: "Battle Styles", series: "Sword & Shield", ptcgoCode: "BST", releaseDate: "2021/03/19" },
  { id: "swsh6", name: "Chilling Reign", series: "Sword & Shield", ptcgoCode: "CRE", releaseDate: "2021/06/18" },
  { id: "swsh7", name: "Evolving Skies", series: "Sword & Shield", ptcgoCode: "EVS", releaseDate: "2021/08/27" },
  { id: "swsh8", name: "Fusion Strike", series: "Sword & Shield", ptcgoCode: "FST", releaseDate: "2021/11/12" },
  { id: "swsh9", name: "Brilliant Stars", series: "Sword & Shield", ptcgoCode: "BRS", releaseDate: "2022/02/25" },
  { id: "swsh10", name: "Astral Radiance", series: "Sword & Shield", ptcgoCode: "ASR", releaseDate: "2022/05/27" },
  { id: "swsh11", name: "Lost Origin", series: "Sword & Shield", ptcgoCode: "LOR", releaseDate: "2022/09/09" },
  { id: "swsh12", name: "Silver Tempest", series: "Sword & Shield", ptcgoCode: "SIT", releaseDate: "2022/11/11" },
  { id: "swsh12pt5", name: "Crown Zenith", series: "Sword & Shield", ptcgoCode: "CRZ", releaseDate: "2023/01/20" },
  { id: "sv1", name: "Scarlet & Violet", series: "Scarlet & Violet", ptcgoCode: "SVI", releaseDate: "2023/03/31" },
  { id: "sv2", name: "Paldea Evolved", series: "Scarlet & Violet", ptcgoCode: "PAL", releaseDate: "2023/06/09" },
  { id: "sv3", name: "Obsidian Flames", series: "Scarlet & Violet", ptcgoCode: "OBF", releaseDate: "2023/08/11" },
  { id: "sv3pt5", name: "151", series: "Scarlet & Violet", ptcgoCode: "MEW", releaseDate: "2023/09/22" },
  { id: "sv4", name: "Paradox Rift", series: "Scarlet & Violet", ptcgoCode: "PAR", releaseDate: "2023/11/03" },
  { id: "sv4pt5", name: "Paldean Fates", series: "Scarlet & Violet", ptcgoCode: "PAF", releaseDate: "2024/01/26" },
  { id: "sv5", name: "Temporal Forces", series: "Scarlet & Violet", ptcgoCode: "TEF", releaseDate: "2024/03/22" },
  { id: "sv6", name: "Twilight Masquerade", series: "Scarlet & Violet", ptcgoCode: "TWM", releaseDate: "2024/05/24" },
  { id: "sv6pt5", name: "Shrouded Fable", series: "Scarlet & Violet", ptcgoCode: "SFA", releaseDate: "2024/08/02" },
  { id: "sv7", name: "Stellar Crown", series: "Scarlet & Violet", ptcgoCode: "SCR", releaseDate: "2024/09/13" },
  { id: "sv8", name: "Surging Sparks", series: "Scarlet & Violet", ptcgoCode: "SSP", releaseDate: "2024/11/08" },
  { id: "sv8pt5", name: "Prismatic Evolutions", series: "Scarlet & Violet", ptcgoCode: "PRE", releaseDate: "2025/01/17" },
  { id: "sv9", name: "Journey Together", series: "Scarlet & Violet", ptcgoCode: "JTG", releaseDate: "2025/03/28" },
  { id: "sv10", name: "Destined Rivals", series: "Scarlet & Violet", ptcgoCode: "DRI", releaseDate: "2025/05/30" },
  { id: "sv10pt5", name: "Black Bolt", series: "Scarlet & Violet", ptcgoCode: "BLK", releaseDate: "2025/07/18" },
  { id: "sv10pt5", name: "White Flare", series: "Scarlet & Violet", ptcgoCode: "WHT", releaseDate: "2025/07/18" },
  { id: "me1", name: "Mega Evolution", series: "Mega Evolution", ptcgoCode: "MEG", releaseDate: "2025/09/26" },
];

function getApiKey() {
  return process.env.POKEMON_TCG_API_KEY || process.env.POKEMONTCG_API_KEY || "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pokemonTcgGet<T>(path: string, params?: Record<string, string | number>) {
  const url = new URL(`${BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const message = `Pokémon TCG API ${res.status} for ${url.pathname}${url.search}: ${text || res.statusText}`;

        // 404 on /cards for future/announced sets should be handled by the caller.
        if (res.status === 404) {
          throw new Error(message);
        }

        lastError = new Error(message);
      } else {
        return (await res.json()) as T;
      }
    } catch (error: any) {
      clearTimeout(timeout);
      lastError = error?.name === "AbortError"
        ? new Error(`Pokémon TCG API timeout for ${url.pathname}${url.search}`)
        : error;

      // 404 should not be retried; it usually means the set/card list is not available.
      if (String(lastError?.message ?? "").includes("Pokémon TCG API 404")) {
        throw lastError;
      }
    }

    if (attempt < MAX_RETRIES) {
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError ?? new Error(`Pokémon TCG API request failed for ${url.pathname}${url.search}`);
}

async function pokemonTcgGetAll<T>(
  path: string,
  params?: Record<string, string | number>
) {
  const rows: T[] = [];
  let page = 1;

  while (true) {
    const json = await pokemonTgGetList<T>(path, {
      ...params,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    rows.push(...json.rows);

    if (!json.hasMore) break;
    page++;
  }

  return rows;
}

async function pokemonTgGetList<T>(
  path: string,
  params: Record<string, string | number>
): Promise<{ rows: T[]; hasMore: boolean }> {
  const json = await pokemonTcgGet<PokemonTcgListResponse<T>>(path, params);
  const rows = Array.isArray(json.data) ? json.data : [];
  const page = Number(json.page ?? params.page ?? 1);
  const pageSize = Number(json.pageSize ?? params.pageSize ?? DEFAULT_PAGE_SIZE);
  const totalCount = Number(json.totalCount ?? 0);

  const hasMore = rows.length > 0 && (totalCount ? page * pageSize < totalCount : rows.length >= pageSize);

  return { rows, hasMore };
}

function parseCachedSets(value: string | null | undefined): CachedTcgSets | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as CachedTcgSets;
    if (!parsed || !Array.isArray(parsed.sets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readCachedTcgSets(options?: { allowStale?: boolean }) {
  const row = await prisma.buylistSetting.findUnique({
    where: { key: SET_CACHE_KEY },
  });

  const cached = parseCachedSets(row?.value);
  if (!cached) return null;

  const savedAt = new Date(cached.savedAt).getTime();
  const fresh = Number.isFinite(savedAt) && Date.now() - savedAt <= SET_CACHE_MAX_AGE_MS;

  if (!fresh && !options?.allowStale) return null;

  return cached.sets;
}

async function saveCachedTcgSets(sets: PokemonTcgSet[]) {
  if (!sets.length) return;

  await prisma.buylistSetting.upsert({
    where: { key: SET_CACHE_KEY },
    create: {
      key: SET_CACHE_KEY,
      value: JSON.stringify({ savedAt: new Date().toISOString(), sets }),
    },
    update: {
      value: JSON.stringify({ savedAt: new Date().toISOString(), sets }),
    },
  });
}

export async function fetchPokemonTcgSets(options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh) {
    const cached = await readCachedTcgSets();
    if (cached?.length) return cached;
  }

  try {
    const sets = await pokemonTcgGetAll<PokemonTcgSet>("/sets", {
      select: "id,name,series,ptcgoCode,releaseDate,images",
    });

    await saveCachedTcgSets(sets);
    return sets;
  } catch (error) {
    const stale = await readCachedTcgSets({ allowStale: true });
    if (stale?.length) return stale;

    // Last-resort fallback: still safe, because products are only imported after
    // fetchPokemonTcgCardsForSet can fetch and match actual English card data.
    return FALLBACK_TCG_SETS;
  }
}

export async function refreshPokemonTcgSetCache() {
  const sets = await pokemonTcgGetAll<PokemonTcgSet>("/sets", {
    select: "id,name,series,ptcgoCode,releaseDate,images",
  });

  await saveCachedTcgSets(sets);
  return sets;
}

export async function fetchPokemonTcgCardsForSet(setId: string) {
  return pokemonTcgGetAll<PokemonTcgCard>("/cards", {
    q: `set.id:${setId}`,
    select: "id,name,number,rarity,images,set",
  });
}
