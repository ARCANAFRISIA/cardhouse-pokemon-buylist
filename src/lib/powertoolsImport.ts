import { prisma } from "@/lib/prisma";
import { parseCsv, type CsvRow } from "@/lib/csv";

const DEFAULT_PAYOUT_PCT = 70;

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
  const raw = normalizeText(value)
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!raw) return null;

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

function mapPowertoolsRow(row: CsvRow) {
  const cardmarketId = parseIntLoose(
    getValue(row, ["cardmarketId", "idProduct", "productId", "id"])
  );

  const name = normalizeText(getValue(row, ["name", "Name"]));
  const setName = normalizeText(getValue(row, ["set", "setName", "expansion", "Expansion"]));
  const setCode = normalizeText(getValue(row, ["setCode", "Set code", "set_code"]));
  const collectorNumber = normalizeText(getValue(row, ["cn", "collectorNumber", "number"]));
  const rarity = normalizeText(getValue(row, ["rarity", "Rarity"]));

  const conditionRaw = normalizeText(getValue(row, ["condition", "Condition"])) || "NM";
  const languageRaw = normalizeText(getValue(row, ["language", "Language"])) || "English";
  const finishRaw = normalizeText(getValue(row, ["finishType", "finish", "printing"])) || "Regular";

  const priceCents = parseEuroToCents(getValue(row, ["price", "Price"]));

  if (!cardmarketId || !name || !priceCents) {
    return null;
  }

  const condition = conditionRaw.toUpperCase().includes("NEAR")
    ? "NM"
    : conditionRaw.toUpperCase();

  const language =
    languageRaw.toLowerCase() === "en" || languageRaw.toLowerCase() === "english"
      ? "English"
      : languageRaw;

  const finishType = finishRaw || "Regular";

  const cardKey = makeCardKey({
    cardmarketId,
    language,
    condition,
    finishType,
  });

  const buyPriceCents = floorBuyPrice(priceCents, DEFAULT_PAYOUT_PCT);

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
  };
}

export async function importPowertoolsCsv(input: {
  text: string;
  filename?: string;
}) {
  const rows = parseCsv(input.text);
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
      const mapped = mapPowertoolsRow(row);

      if (!mapped) {
        skipped++;
        continue;
      }

      // MVP-filter: alleen English + NM importeren.
      if (mapped.language !== "English" || mapped.condition !== "NM") {
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
          payoutPct: DEFAULT_PAYOUT_PCT,
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