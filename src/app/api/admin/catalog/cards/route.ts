import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBuylistSettings } from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toEuro(cents: number | null | undefined) {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim();
    const status = searchParams.get("status") ?? "all";
    const setCode = (searchParams.get("setCode") ?? "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100), 1), 250);
    const settings = await getBuylistSettings();

    const where = {
      ...(status === "active" ? { active: true } : {}),
      ...(status === "inactive" ? { active: false } : {}),
      ...(status === "priced"
        ? {
            prices: {
              some: { isCurrent: true },
            },
          }
        : {}),
      ...(status === "unpriced"
        ? {
            prices: {
              none: { isCurrent: true },
            },
          }
        : {}),
      ...(setCode.length > 0
        ? { setCode: { contains: setCode, mode: "insensitive" as const } }
        : {}),
      ...(q.length >= 2
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { setName: { contains: q, mode: "insensitive" as const } },
              { setCode: { contains: q, mode: "insensitive" as const } },
              { collectorNumber: { contains: q, mode: "insensitive" as const } },
              { rarity: { contains: q, mode: "insensitive" as const } },
              ...(Number.isFinite(Number(q)) ? [{ cardmarketId: Number(q) }] : []),
            ],
          }
        : {}),
    };

    const cards = await prisma.pokemonCard.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: limit,
      include: {
        prices: {
          where: { isCurrent: true },
          orderBy: { importedAt: "desc" },
          take: 1,
        },
      },
    });

    const items = cards.map((card) => {
      const price = card.prices[0] ?? null;
      const visibleOnBuylist =
        card.active &&
        card.language === "English" &&
        card.condition === "NM" &&
        Boolean(price?.buyPriceCents && price.buyPriceCents >= settings.minimumBuyPriceCents);

      return {
        id: card.id,
        cardKey: card.cardKey,
        cardmarketId: card.cardmarketId,
        name: card.name,
        setName: card.setName,
        setCode: card.setCode,
        collectorNumber: card.collectorNumber,
        rarity: card.rarity,
        series: card.series,
        language: card.language,
        condition: card.condition,
        finishType: card.finishType,
        imageUrl: card.imageUrl,
        active: card.active,
        hasImage: Boolean(card.imageUrl),
        visibleOnBuylist,
        marketPrice: toEuro(price?.marketPriceCents),
        buyPrice: toEuro(price?.buyPriceCents),
        payoutPct: price?.payoutPct ?? null,
        priceSource: price?.source ?? null,
        importedAt: price?.importedAt ?? null,
        updatedAt: card.updatedAt,
      };
    });

    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Catalog cards failed" },
      { status: 500 }
    );
  }
}
