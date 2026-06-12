import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as { active?: boolean };

    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "active must be boolean" },
        { status: 400 }
      );
    }

    const card = await prisma.pokemonCard.update({
      where: { id },
      data: { active: body.active },
    });

    return NextResponse.json({ ok: true, id: card.id, active: card.active });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Could not update card" },
      { status: 500 }
    );
  }
}
