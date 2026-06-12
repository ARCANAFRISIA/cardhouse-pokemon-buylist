import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendMail } from "@/lib/mail";
import { customerAdjustedItemsEmail } from "@/lib/submissionEmails";

import { getBuylistSettings } from "@/lib/buylistSettings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ItemUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        qty: z.number().int().min(0).max(999),
        unitCents: z.number().int().min(0).max(10_000_000),
        itemStatus: z.enum(["PENDING", "ACCEPTED", "ADJUSTED", "REJECTED"]),
        receivedCondition: z.enum(["NM", "EX", "OTHER"]).nullable().optional(),
        adminNote: z.string().trim().max(2000).optional().or(z.literal("")),
      })
    )
    .min(1),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

type StatusEvent = {
  ts: string;
  type: string;
  message?: string | null;
  changes?: Array<{
    itemId: string;
    cardName: string | null;
    before: {
      qty: number;
      unitCents: number;
      lineCents: number;
      itemStatus: string;
      receivedCondition: string | null;
    };
    after: {
      qty: number;
      unitCents: number;
      lineCents: number;
      itemStatus: string;
      receivedCondition: string | null;
    };
    note?: string | null;
  }>;
};

function parseMetaEvents(metaText: string | null): StatusEvent[] {
  if (!metaText) return [];

  try {
    const parsed = JSON.parse(metaText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanNote(value: string | undefined) {
  const clean = (value ?? "").trim();
  return clean ? clean : null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const parsed = ItemUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid item update",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!submission) {
      return NextResponse.json(
        { ok: false, error: "Submission not found" },
        { status: 404 }
      );
    }

    const existingById = new Map(submission.items.map((item) => [item.id, item]));
    const events = parseMetaEvents(submission.metaText);
    const changes: StatusEvent["changes"] = [];

    await prisma.$transaction(async (tx) => {
      for (const update of parsed.data.items) {
        const existing = existingById.get(update.id);

        if (!existing) {
          continue;
        }

        const qty = update.itemStatus === "REJECTED" ? 0 : update.qty;
        const unitCents = update.itemStatus === "REJECTED" ? 0 : update.unitCents;
        const lineCents = qty * unitCents;

        const changed =
          existing.qty !== qty ||
          existing.unitCents !== unitCents ||
          existing.lineCents !== lineCents ||
          existing.itemStatus !== update.itemStatus ||
          existing.receivedCondition !== (update.receivedCondition ?? null) ||
          (existing.adminNote ?? "") !== (update.adminNote ?? "");

        if (!changed) {
          continue;
        }

        changes?.push({
          itemId: existing.id,
          cardName: existing.cardName,
          before: {
            qty: existing.qty,
            unitCents: existing.unitCents,
            lineCents: existing.lineCents,
            itemStatus: existing.itemStatus,
            receivedCondition: existing.receivedCondition,
          },
          after: {
            qty,
            unitCents,
            lineCents,
            itemStatus: update.itemStatus,
            receivedCondition: update.receivedCondition ?? null,
          },
          note: cleanNote(update.adminNote),
        });

        await tx.submissionItem.update({
          where: { id: existing.id },
          data: {
            qty,
            unitCents,
            lineCents,
            itemStatus: update.itemStatus,
            receivedCondition: update.receivedCondition ?? null,
            adminNote: cleanNote(update.adminNote),

            originalQty: existing.originalQty ?? existing.qty,
            originalUnitCents: existing.originalUnitCents ?? existing.unitCents,
          },
        });
      }

      const freshItems = await tx.submissionItem.findMany({
        where: { submissionId: id },
      });

      const newTotal = freshItems.reduce((sum, item) => sum + item.lineCents, 0);

      const nextEvents = [...events];

      if (changes && changes.length > 0) {
        nextEvents.push({
          ts: new Date().toISOString(),
          type: "items",
          message: cleanNote(parsed.data.message) ?? "Items adjusted",
          changes,
        });
      }

      await tx.submission.update({
        where: { id },
        data: {
          subtotalCents: newTotal,
          serverTotalCents: newTotal,
          status: changes && changes.length > 0 ? "ADJUSTED" : submission.status,
          metaText: JSON.stringify(nextEvents),
        },
      });
    });

        if (changes && changes.length > 0) {
      try {
        const updatedSubmission = await prisma.submission.findUnique({
          where: { id },
          include: {
            items: true,
          },
        });

        if (updatedSubmission?.email) {
          const mail = customerAdjustedItemsEmail(
            updatedSubmission,
            changes,
            cleanNote(parsed.data.message)
          );

          await sendMail({
            to: updatedSubmission.email,
            subject: mail.subject,
            html: mail.html,
            replyTo: process.env.MAIL_REPLY_TO ?? process.env.MAIL_ADMIN,
          });
        }
      } catch (mailError) {
        console.warn("[admin item update] adjustment mail failed:", mailError);
      }
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("[admin item update] failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Item update failed",
      },
      { status: 500 }
    );
  }
}