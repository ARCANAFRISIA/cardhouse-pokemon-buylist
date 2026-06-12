import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBuylistSettings } from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toEuro(cents: number | null) {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

function normalizeFilter(value: string | null) {
  const clean = (value ?? "").trim();
  return clean && clean !== "all" ? clean : null;
}

export async function GET(req: NextRequest) {
  try {
    const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const setCode = normalizeFilter(req.nextUrl.searchParams.get("setCode"));
    const rarity = normalizeFilter(req.nextUrl.searchParams.get("rarity"));
    const sort = req.nextUrl.searchParams.get("sort") ?? "name-asc";
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
      ...(setCode
        ? {
            setCode: {
              equals: setCode,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(rarity
        ? {
            rarity: {
              equals: rarity,
              mode: "insensitive" as const,
            },
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

    const cards = await prisma.pokemonCard.findMany({
      where,
      orderBy:
        sort === "newest"
          ? [{ updatedAt: "desc" }, { name: "asc" }]
          : [{ name: "asc" }, { setName: "asc" }],
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
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (sort === "price-desc") return (b.buyPrice ?? 0) - (a.buyPrice ?? 0);
        if (sort === "price-asc") return (a.buyPrice ?? 0) - (b.buyPrice ?? 0);
        if (sort === "set") {
          const setCompare = String(a.setName ?? "").localeCompare(String(b.setName ?? ""));
          if (setCompare !== 0) return setCompare;
          return String(a.collectorNumber ?? "").localeCompare(String(b.collectorNumber ?? ""), undefined, { numeric: true });
        }
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });

    const filterRows = await prisma.pokemonCard.findMany({
      where: {
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
      },
      select: {
        setCode: true,
        setName: true,
        rarity: true,
      },
      distinct: ["setCode", "setName", "rarity"],
      take: 5000,
    });

    const setOptions = Array.from(
      new Map(
        filterRows
          .filter((row) => row.setCode || row.setName)
          .map((row) => [
            row.setCode || row.setName || "",
            {
              setCode: row.setCode || row.setName || "",
              label: row.setName
                ? `${row.setName}${row.setCode ? ` (${row.setCode})` : ""}`
                : row.setCode || "Unknown set",
            },
          ])
      ).values()
    ).sort((a, b) => a.label.localeCompare(b.label));

    const rarityOptions = Array.from(
      new Set(filterRows.map((row) => row.rarity).filter((value): value is string => Boolean(value)))
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      ok: true,
      query,
      count: items.length,
      items,
      filters: {
        sets: setOptions,
        rarities: rarityOptions,
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
