import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBuylistSettings } from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toEuro(cents: number | null) {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

export async function GET(req: NextRequest) {
  try {
    const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const settings = await getBuylistSettings();
    const limit = Math.min(
      Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1),
      100
    );

    const where = {
      active: true,
      language: "English",
      condition: "NM",
      prices: {
        some: {
          isCurrent: true,
          buyPriceCents: {
            gte: settings.minimumBuyPriceCents,
          },
        },
      },
      ...(query.length >= 2
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { setName: { contains: query, mode: "insensitive" as const } },
              { setCode: { contains: query, mode: "insensitive" as const } },
              {
                collectorNumber: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
              {
                rarity: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const cards = await prisma.pokemonCard.findMany({
      where,
      orderBy: [{ name: "asc" }, { setName: "asc" }],
      take: limit,
      include: {
        prices: {
          where: {
            isCurrent: true,
          },
          orderBy: {
            importedAt: "desc",
          },
          take: 1,
        },
      },
    });

    const items = cards
      .map((card) => {
        const price = card.prices[0] ?? null;

        if (
  !price?.buyPriceCents ||
  price.buyPriceCents < settings.minimumBuyPriceCents
) {
          return null;
        }

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
          marketPrice: toEuro(price.marketPriceCents),
          buyPrice: toEuro(price.buyPriceCents),
          priceSource: price.source,
          importedAt: price.importedAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      query,
      count: items.length,
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Search failed",
      },
      { status: 500 }
    );
  }
}