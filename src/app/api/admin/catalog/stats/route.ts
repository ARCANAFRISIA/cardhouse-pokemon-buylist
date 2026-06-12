import { NextResponse } from "next/server";
import { getPokemonCatalogStats } from "@/lib/pokemonCatalogImport";
import { getBuylistSettings } from "@/lib/buylistSettings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [stats, settings] = await Promise.all([
      getPokemonCatalogStats(),
      getBuylistSettings(),
    ]);

    const visibleBuylistCards = await prisma.pokemonCard.count({
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
    });

    return NextResponse.json({
      ok: true,
      ...stats,
      visibleBuylistCards,
      minimumBuyPriceCents: settings.minimumBuyPriceCents,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Could not load catalog stats" },
      { status: 500 }
    );
  }
}
