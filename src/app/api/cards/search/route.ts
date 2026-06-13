import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBuylistSettings } from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Temporary manual set priority.
 * Later this can be replaced with a real releaseDate field on PokemonCard.
 */
const SET_PRIORITY: Record<string, number> = {
  CRI: 10_000, // Chaos Rising
  POR: 9_900, // Perfect Order
 
};

type SortKey =
  | "newest_price"
  | "name"
  | "price_desc"
  | "price_asc"
  | "set"
  | "updated";

type SearchItem = {
  id: string;
  cardKey: string;
  cardmarketId: number;
  name: string;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  series: string | null;
  language: string;
  condition: string;
  finishType: string;
  imageUrl: string | null;
  marketPrice: number | null;
  buyPrice: number | null;
  priceSource: string;
  importedAt: Date;
};

function toEuro(cents: number | null) {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

function normalizeFilter(value: string | null) {
  const clean = (value ?? "").trim();
  return clean && clean !== "all" ? clean : null;
}

function setPriority(setCode: string | null, setName: string | null) {
  const code = String(setCode ?? "").trim().toUpperCase();

  if (SET_PRIORITY[code] != null) {
    return SET_PRIORITY[code];
  }

  const name = String(setName ?? "").toLowerCase();

  if (name.includes("chaos rising")) return 10_000;
  if (name.includes("perfect order")) return 9_900;


  return 0;
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

function byName(a: SearchItem, b: SearchItem) {
  return (
    String(a.name ?? "").localeCompare(String(b.name ?? ""), "nl-NL") ||
    String(a.setName ?? "").localeCompare(String(b.setName ?? ""), "nl-NL") ||
    String(a.collectorNumber ?? "").localeCompare(
      String(b.collectorNumber ?? ""),
      "nl-NL",
      { numeric: true }
    )
  );
}

function sortItems(items: SearchItem[], sort: SortKey) {
  return [...items].sort((a, b) => {
    if (sort === "newest_price") {
      const priorityDiff =
        setPriority(b.setCode, b.setName) - setPriority(a.setCode, a.setName);

      if (priorityDiff !== 0) return priorityDiff;

      return (b.buyPrice ?? 0) - (a.buyPrice ?? 0) || byName(a, b);
    }

    if (sort === "price_desc") {
      return (b.buyPrice ?? 0) - (a.buyPrice ?? 0) || byName(a, b);
    }

    if (sort === "price_asc") {
      return (a.buyPrice ?? 0) - (b.buyPrice ?? 0) || byName(a, b);
    }

    if (sort === "set") {
      return (
        setPriority(b.setCode, b.setName) - setPriority(a.setCode, a.setName) ||
        String(a.setName ?? "").localeCompare(String(b.setName ?? ""), "nl-NL") ||
        String(a.collectorNumber ?? "").localeCompare(
          String(b.collectorNumber ?? ""),
          "nl-NL",
          { numeric: true }
        ) ||
        byName(a, b)
      );
    }

    if (sort === "updated") {
      return (
        new Date(b.importedAt ?? 0).getTime() -
          new Date(a.importedAt ?? 0).getTime() || byName(a, b)
      );
    }

    return byName(a, b);
  });
}

function parseSort(value: string | null): SortKey {
  const clean = String(value ?? "newest_price");

  if (
    clean === "newest_price" ||
    clean === "name" ||
    clean === "price_desc" ||
    clean === "price_asc" ||
    clean === "set" ||
    clean === "updated"
  ) {
    return clean;
  }

  return "newest_price";
}

export async function GET(req: NextRequest) {
  try {
    const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const selectedSet = normalizeFilter(req.nextUrl.searchParams.get("setCode"));
    const selectedRarity = normalizeFilter(req.nextUrl.searchParams.get("rarity"));
    const sort = parseSort(req.nextUrl.searchParams.get("sort"));

    const settings = await getBuylistSettings();
    const limit = Math.min(
      Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1),
      100
    );

    const baseWhere = makeBaseWhere(settings.minimumBuyPriceCents);

    const where = {
      ...baseWhere,
      ...(selectedSet ? { setCode: selectedSet } : {}),
      ...(selectedRarity ? { rarity: selectedRarity } : {}),
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

    /**
     * Important:
     * We fetch wider than the requested limit, because newest_price is a custom
     * post-query sort. If we fetched only 50 rows alphabetically, we would sort
     * the wrong 50 cards.
     */
    const searchTake = Math.max(limit * 50, 2500);

    const [cards, filterCards] = await Promise.all([
      prisma.pokemonCard.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        take: searchTake,
        include: {
          prices: {
            where: { isCurrent: true },
            orderBy: { importedAt: "desc" },
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
        take: 10_000,
        orderBy: [{ setName: "asc" }, { rarity: "asc" }],
      }),
    ]);

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
      .filter((item): item is SearchItem => item !== null);

    const sortedItems = sortItems(items, sort).slice(0, limit);

    const setMap = new Map<string, { value: string; label: string; priority: number }>();
    const raritySet = new Set<string>();

    for (const card of filterCards) {
      if (card.setCode) {
        setMap.set(card.setCode, {
          value: card.setCode,
          label: card.setName ? `${card.setName} (${card.setCode})` : card.setCode,
          priority: setPriority(card.setCode, card.setName),
        });
      }

      if (card.rarity) {
        raritySet.add(card.rarity);
      }
    }

    const sets = Array.from(setMap.values())
      .sort(
        (a, b) =>
          b.priority - a.priority || a.label.localeCompare(b.label, "nl-NL")
      )
      .map(({ value, label }) => ({ value, label }));

    const rarities = Array.from(raritySet.values()).sort((a, b) =>
      a.localeCompare(b, "nl-NL")
    );

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
