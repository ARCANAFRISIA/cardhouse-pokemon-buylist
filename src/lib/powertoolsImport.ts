import { prisma } from "@/lib/prisma";
import { parseCsv, type CsvRow } from "@/lib/csv";
import {
  getBuylistSettings,
  getPayoutPctForMarketPriceCents,
  type BuylistSettings,
} from "@/lib/buylistSettings";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function parseIntLoose(value: unknown): number | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  const n = Number.parseInt(raw.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseEuroToCents(value: unknown): number | null {
  let raw = normalizeText(value).replace(/[€\s]/g, "");

  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    raw = raw.replace(",", ".");
  } else if (hasDot) {
    raw = raw;
  }

  const n = Number(raw);

  if (!Number.isFinite(n) || n <= 0) return null;

  return Math.round(n * 100);
}

function floorBuyPrice(marketPriceCents: number, payoutPct: number) {
  return Math.floor((marketPriceCents * payoutPct) / 100);
}

function getValue(row: CsvRow, names: string[]) {
  for (const name of names) {
    if (row[name] != null && row[name] !== "") return row[name];
  }
  return "";
}

function makeCardKey(input: {
  cardmarketId: number;
  language: string;
  condition: string;
  finishType: string;
}) {
  return [
    input.cardmarketId,
    normalizeUpper(input.language || "English"),
    normalizeUpper(input.condition || "NM"),
    normalizeUpper(input.finishType || "Regular"),
  ].join("|");
}

function normalizeLanguage(value: string) {
  const raw = value.trim();
  const lower = raw.toLowerCase();

  if (lower === "en" || lower === "eng" || lower === "english") {
    return "English";
  }

  if (
    lower === "jp" ||
    lower === "jpn" ||
    lower === "ja" ||
    lower === "japanese" ||
    lower === "japans"
  ) {
    return "Japanese";
  }

  return raw;
}

function normalizeCondition(value: string) {
  const upper = value.toUpperCase();

  if (upper.includes("NEAR")) return "NM";
  if (upper === "MINT") return "NM";

  return upper;
}

function mapPowertoolsRow(row: CsvRow, settings: BuylistSettings) {
  const cardmarketId = parseIntLoose(
    getValue(row, ["cardmarketId", "idProduct", "productId", "id"])
  );

  const name = normalizeText(getValue(row, ["name", "Name"]));
  const setName = normalizeText(
    getValue(row, ["set", "setName", "expansion", "Expansion"])
  );
  const setCode = normalizeText(
    getValue(row, ["setCode", "Set code", "set_code"])
  );
  const collectorNumber = normalizeText(
    getValue(row, ["cn", "collectorNumber", "number"])
  );
  const rarity = normalizeText(getValue(row, ["rarity", "Rarity"]));

  const conditionRaw =
    normalizeText(getValue(row, ["condition", "Condition"])) || "NM";
  const languageRaw =
    normalizeText(getValue(row, ["language", "Language"])) || "English";
  const finishRaw =
    normalizeText(getValue(row, ["finishType", "finish", "printing"])) ||
    "Regular";

  const priceCents = parseEuroToCents(getValue(row, ["price", "Price"]));

  if (!cardmarketId || !name || !priceCents) {
    return null;
  }

  const condition = normalizeCondition(conditionRaw);
  const language = normalizeLanguage(languageRaw);
  const finishType = finishRaw || "Regular";

  const cardKey = makeCardKey({
    cardmarketId,
    language,
    condition,
    finishType,
  });

  const payoutPct = getPayoutPctForMarketPriceCents(priceCents, settings);
  const buyPriceCents = floorBuyPrice(priceCents, payoutPct);

  return {
    cardKey,
    cardmarketId,
    name,
    setName: setName || null,
    setCode: setCode || null,
    collectorNumber: collectorNumber || null,
    rarity: rarity || null,
    language,
    condition,
    finishType,
    marketPriceCents: priceCents,
    buyPriceCents,
    payoutPct,
  };
}

export async function importPowertoolsCsv(input: {
  text: string;
  filename?: string;
}) {
  const rows = parseCsv(input.text);
  const settings = await getBuylistSettings();

  let imported = 0;
  let skipped = 0;

  const batch = await prisma.importBatch.create({
    data: {
      type: "POWERTOOLS_EXPORT",
      filename: input.filename ?? null,
      rowCount: rows.length,
      success: false,
      message: "Import started",
    },
  });

  try {
    for (const row of rows) {
      const mapped = mapPowertoolsRow(row, settings);

      if (!mapped) {
        skipped++;
        continue;
      }

      // Pokémon MVP: alleen NM importeren.
      // English en Japanese mogen allebei, zolang ze als eigen Cardmarket SKU binnenkomen.
      if (
        !["English", "Japanese"].includes(mapped.language) ||
        mapped.condition !== "NM"
      ) {
        skipped++;
        continue;
      }

      await prisma.pokemonCard.upsert({
        where: { cardKey: mapped.cardKey },
        create: {
          cardKey: mapped.cardKey,
          cardmarketId: mapped.cardmarketId,
          name: mapped.name,
          setName: mapped.setName,
          setCode: mapped.setCode,
          collectorNumber: mapped.collectorNumber,
          rarity: mapped.rarity,
          language: mapped.language,
          condition: mapped.condition,
          finishType: mapped.finishType,
          active: true,
        },
        update: {
          name: mapped.name,
          setName: mapped.setName,
          setCode: mapped.setCode,
          collectorNumber: mapped.collectorNumber,
          rarity: mapped.rarity,
          language: mapped.language,
          condition: mapped.condition,
          finishType: mapped.finishType,
          active: true,
        },
      });

      await prisma.pokemonPrice.updateMany({
        where: {
          cardKey: mapped.cardKey,
          source: "POWERTOOLS",
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });

      await prisma.pokemonPrice.create({
        data: {
          cardKey: mapped.cardKey,
          cardmarketId: mapped.cardmarketId,
          source: "POWERTOOLS",
          marketPriceCents: mapped.marketPriceCents,
          buyPriceCents: mapped.buyPriceCents,
          payoutPct: mapped.payoutPct,
          isCurrent: true,
        },
      });

      imported++;
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        success: true,
        message: `Imported ${imported}, skipped ${skipped}`,
      },
    });

    return {
      ok: true,
      batchId: batch.id,
      rows: rows.length,
      imported,
      skipped,
    };
  } catch (error: any) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        success: false,
        message: error?.message ?? "Import failed",
      },
    });

    throw error;
  }
}