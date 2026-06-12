import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { sendMail } from "@/lib/mail";
import { customerStatusEmail } from "@/lib/submissionEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = [
  "SUBMITTED",
  "RECEIVED",
  "CHECKING",
  "ADJUSTED",
  "APPROVED",
  "PAID",
  "REJECTED",
] as const;

const StatusSchema = z.object({
  status: z.enum(ALLOWED_STATUSES),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

type StatusEvent = {
  ts: string;
  type: "status";
  from?: string | null;
  to: string;
  message?: string | null;
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const parsed = StatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid status update",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const existing = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        metaText: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Submission not found",
        },
        { status: 404 }
      );
    }

    const events = parseMetaEvents(existing.metaText);
    const message = parsed.data.message?.trim() || null;

    events.push({
      ts: new Date().toISOString(),
      type: "status",
      from: existing.status,
      to: parsed.data.status,
      message,
    });

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        status: parsed.data.status,
        customerMessage:
          parsed.data.status === "ADJUSTED" || parsed.data.status === "REJECTED"
            ? message
            : undefined,
        metaText: JSON.stringify(events),
      },
      include: {
        items: true,
      },
    });

    try {
      if (
        updated.email &&
        ["RECEIVED", "CHECKING", "ADJUSTED", "APPROVED", "PAID", "REJECTED"].includes(
          updated.status
        )
      ) {
        const mail = customerStatusEmail(updated, updated.status, message);

        await sendMail({
          to: updated.email,
          subject: mail.subject,
          html: mail.html,
          replyTo: process.env.MAIL_REPLY_TO ?? process.env.MAIL_ADMIN,
        });
      }
    } catch (mailError) {
      console.warn("[admin status update] customer mail failed:", mailError);
    }
    return NextResponse.json({
      ok: true,
      submission: updated,
    });
  } catch (error: any) {
    console.error("[admin status update] failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Status update failed",
      },
      { status: 500 }
    );
  }
}