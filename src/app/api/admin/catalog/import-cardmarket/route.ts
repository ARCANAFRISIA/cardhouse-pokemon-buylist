import { NextRequest, NextResponse } from "next/server";
import { importPokemonCatalogFromCardmarket } from "@/lib/pokemonCatalogImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseExpansionIds(value: string | null) {
  if (!value) return undefined;

  const ids = [...new Set(
    value
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isFinite(id) && id > 0)
  )];

  return ids.length ? ids : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const expansionIds = parseExpansionIds(searchParams.get("ids"));
    const limitExpansions = Math.min(
      Math.max(Number(searchParams.get("limitExpansions") ?? 10), 1),
      75
    );
    const dryRun = searchParams.get("dryRun") === "1";

    const result = await importPokemonCatalogFromCardmarket({
      expansionIds,
      limitExpansions,
      dryRun,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Catalog import failed",
      },
      { status: 500 }
    );
  }
}
