import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getBuylistSettings,
  saveBuylistSettings,
} from "@/lib/buylistSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SettingsSchema = z.object({
  generalPayoutPct: z.number().int().min(1).max(95),
  excellentPenaltyPct: z.number().int().min(0).max(95),
  minimumBuyPriceCents: z.number().int().min(0).max(100000),
  customerCanShipDirectly: z.boolean(),
  shippingInstructions: z.string().trim().min(10).max(5000),
  termsText: z.string().trim().min(10).max(10000),
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