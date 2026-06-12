import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_BUYLIST_SETTINGS,
  getBuylistSettings,
  saveBuylistSettings,
} from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PayoutTierSchema = z
  .object({
    label: z.string().trim().max(80).optional().default(""),
    minCents: z.number().int().min(0).max(100_000_000),
    maxCents: z.number().int().min(0).max(100_000_000).nullable().optional().default(null),
    payoutPct: z.number().int().min(1).max(95),
  })
  .refine((tier) => tier.maxCents == null || tier.maxCents > tier.minCents, {
    message: "maxCents must be greater than minCents",
    path: ["maxCents"],
  });

const BulkCategorySchema = z
  .object({
    id: z.string().trim().min(3).max(80),
    enabled: z.boolean(),
    label: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional().default(""),
    unitCents: z.number().int().min(0).max(100_000),
    minQty: z.number().int().min(1).max(100_000),
    maxQty: z.number().int().min(1).max(100_000).nullable().optional().default(null),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional().default(0),
  })
  .refine((category) => category.maxQty == null || category.maxQty >= category.minQty, {
    message: "maxQty must be greater than or equal to minQty",
    path: ["maxQty"],
  });

const SettingsSchema = z.object({
  generalPayoutPct: z.number().int().min(1).max(95),
  excellentPenaltyPct: z.number().int().min(0).max(95),
  minimumBuyPriceCents: z.number().int().min(0).max(100000),
  customerCanShipDirectly: z.boolean(),
  shippingInstructions: z.string().trim().min(10).max(5000),
  termsText: z.string().trim().min(10).max(10000),
  payoutTiers: z.array(PayoutTierSchema).max(30).optional().default(DEFAULT_BUYLIST_SETTINGS.payoutTiers),
  bulkCategories: z.array(BulkCategorySchema).max(30).optional().default(DEFAULT_BUYLIST_SETTINGS.bulkCategories),
});

export async function GET() {
  const settings = await getBuylistSettings();

  return NextResponse.json({
    ok: true,
    settings,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid settings",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await saveBuylistSettings(parsed.data);

    return NextResponse.json({
      ok: true,
      settings: parsed.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Settings update failed",
      },
      { status: 500 }
    );
  }
}
