import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEnglishPokemonCatalogCard } from "@/lib/pokemonCatalogImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = [
  "cardmarketId",
  "quantity",
  "name",
  "set",
  "cn",
  "condition",
  "language",
  "isFirstEd",
  "isReverseHolo",
  "isSigned",
  "price",
  "comment",
  "finishType",
  "buyPrice",
];

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function centsToEuroText(value: number | null | undefined) {
  if (!value || value <= 0) return null;
  return (value / 100).toFixed(2);
}

function makeCsv(rows: Array<Record<string, unknown>>) {
  return [
    HEADERS.join(","),
    ...rows.map((row) => HEADERS.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 5000), 1), 25000);
    const q = (searchParams.get("q") ?? "").trim();
    const onlyUnpriced = searchParams.get("onlyUnpriced") === "1";
    const useCurrentPrices = searchParams.get("useCurrentPrices") === "1";

    const cards = await prisma.pokemonCard.findMany({
      where: {
        active: true,
        language: "English",
        condition: "NM",
        finishType: "Regular",
        ...(onlyUnpriced
          ? {
              prices: {
                none: {
                  isCurrent: true,
                },
              },
            }
          : {}),
        ...(q.length >= 2
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { setName: { contains: q, mode: "insensitive" as const } },
                { setCode: { contains: q, mode: "insensitive" as const } },
                { collectorNumber: { contains: q, mode: "insensitive" as const } },
                { rarity: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ setName: "asc" }, { collectorNumber: "asc" }, { name: "asc" }],
      take: limit,
      include: {
        prices: {
          where: { isCurrent: true },
          orderBy: { importedAt: "desc" },
          take: 1,
        },
      },
    });

    const rows = cards
      .filter((card) =>
        isEnglishPokemonCatalogCard({
          name: card.name,
          setName: card.setName,
          setCode: card.setCode,
        })
      )
      .map((card) => {
        const price = card.prices[0] ?? null;
        const currentMarketPrice = centsToEuroText(price?.marketPriceCents);
        const currentBuyPrice = centsToEuroText(price?.buyPriceCents);

        return {
          cardmarketId: card.cardmarketId,
          quantity: 1,
          name: card.name,
          set: card.setName ?? "",
          cn: card.collectorNumber ?? "",
          condition: "NM",
          language: "English",
          isFirstEd: "",
          isReverseHolo: "",
          isSigned: "",
          // PowerTools needs values here. Default template values are intentionally high
          // so PowerTools autoprice clearly replaces them before re-import.
          price: useCurrentPrices && currentMarketPrice ? currentMarketPrice : "1000",
          comment: "",
          finishType: card.finishType || "Regular",
          buyPrice: useCurrentPrices && currentBuyPrice ? currentBuyPrice : "500",
        };
      });

    const csv = makeCsv(rows);
    const filename = `cardhouse-pokemon-powertools-import-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "PowerTools export failed" },
      { status: 500 }
    );
  }
}
