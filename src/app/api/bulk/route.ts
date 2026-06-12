import { NextResponse } from "next/server";

import { getActiveBulkCategories, getBuylistSettings } from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toEuro(cents: number) {
  return Math.round(cents) / 100;
}

export async function GET() {
  try {
    const settings = await getBuylistSettings();
    const categories = getActiveBulkCategories(settings).map((category) => ({
      id: category.id,
      label: category.label,
      description: category.description,
      unitCents: category.unitCents,
      unitPrice: toEuro(category.unitCents),
      minQty: category.minQty,
      maxQty: category.maxQty,
      sortOrder: category.sortOrder,
    }));

    return NextResponse.json({ ok: true, categories });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Bulk settings failed" },
      { status: 500 }
    );
  }
}
