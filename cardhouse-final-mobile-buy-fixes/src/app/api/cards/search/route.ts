import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBuylistSettings } from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SortKey = "name" | "price_desc" | "price_asc" | "set" | "updated";

function toEuro(cents: number | null) {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

function normalizeFilter(value: string | null) {
  const clean = (value ?? "").trim();
  return clean && clean !== "all" ? clean : null;
}

function makeBaseWhere(minimumBuyPriceCents: number) {
  return {
    active: true,
    language: "English",
    condition: "NM",
    prices: {
      some: {
        isCurrent: true,
        buyPriceCents: {
          gte: minimumBuyPriceCents,
        },
      },
    },
  };
}

function sortItems<T extends { name: string; setName: string | null; collectorNumber: string | null; buyPrice: number | null; importedAt: Date | string | null }>(
  items: T[],
  sort: SortKey
) {
  const byName = (a: T, b: T) =>
    a.name.localeCompare(b.name) ||
    String(a.setName ?? "").localeCompare(String(b.setName ?? "")) ||
    String(a.collectorNumber ?? "").localeCompare(String(b.collectorNumber ?? ""), undefined, {
      numeric: true,
    });

  return [...items].sort((a, b) => {
    if (sort === "price_desc") {
      return (b.buyPrice ?? 0) - (a.buyPrice ?? 0) || byName(a, b);
    }

    if (sort === "price_asc") {
      return (a.buyPrice ?? 0) - (b.buyPrice ?? 0) || byName(a, b);
    }

    if (sort === "set") {
      return (
        String(a.setName ?? "").localeCompare(String(b.setName ?? "")) ||
        String(a.collectorNumber ?? "").localeCompare(String(b.collectorNumber ?? ""), undefined, {
          numeric: true,
        }) ||
        byName(a, b)
      );
    }

    if (sort === "updated") {
      return new Date(b.importedAt ?? 0).getTime() - new Date(a.importedAt ?? 0).getTime() || byName(a, b);
    }

    return byName(a, b);
  });
}

export async function GET(req: NextRequest) {
  try {
    const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const selectedSet = normalizeFilter(req.nextUrl.searchParams.get("setCode"));
    const selectedRarity = normalizeFilter(req.nextUrl.searchParams.get("rarity"));
    const sortParam = (req.nextUrl.searchParams.get("sort") ?? "name") as SortKey;
    const sort: SortKey = ["name", "price_desc", "price_asc", "set", "updated"].includes(sortParam)
      ? sortParam
      : "name";

    const settings = await getBuylistSettings();
    const limit = Math.min(
      Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1),
      100
    );

    const baseWhere = makeBaseWhere(settings.minimumBuyPriceCents);

    const where = {
      ...baseWhere,
      ...(selectedSet
        ? {
            setCode: selectedSet,
          }
        : {}),
      ...(selectedRarity
        ? {
            rarity: selectedRarity,
          }
        : {}),
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

    const [cards, filterCards] = await Promise.all([
      prisma.pokemonCard.findMany({
        where,
        orderBy: [{ name: "asc" }, { setName: "asc" }],
        take: Math.max(limit, 100),
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
      }),
      prisma.pokemonCard.findMany({
        where: baseWhere,
        select: {
          setCode: true,
          setName: true,
          rarity: true,
        },
        take: 5000,
        orderBy: [{ setName: "asc" }, { rarity: "asc" }],
      }),
    ]);

    const items = cards
      .map((card) => {
        const price = card.prices[0] ?? null;

        if (!price?.buyPriceCents || price.buyPriceCents < settings.minimumBuyPriceCents) {
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
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const sortedItems = sortItems(items, sort).slice(0, limit);

    const setMap = new Map<string, { value: string; label: string }>();
    const raritySet = new Set<string>();

    for (const card of filterCards) {
      if (card.setCode) {
        setMap.set(card.setCode, {
          value: card.setCode,
          label: card.setName ? `${card.setName} (${card.setCode})` : card.setCode,
        });
      }

      if (card.rarity) {
        raritySet.add(card.rarity);
      }
    }

    const sets = Array.from(setMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    const rarities = Array.from(raritySet.values()).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      ok: true,
      query,
      count: sortedItems.length,
      items: sortedItems,
      filters: {
        sets,
        rarities,
      },
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
