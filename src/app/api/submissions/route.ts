import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { getBuylistSettings } from "@/lib/buylistSettings";
import { sendMail } from "@/lib/mail";
import {
  adminNewSubmissionEmail,
  customerSubmissionConfirmationEmail,
} from "@/lib/submissionEmails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



const SubmitSchema = z.object({
  customer: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    phone: z.string().trim().max(80).optional().or(z.literal("")),

    addressLine1: z.string().trim().max(180).optional().or(z.literal("")),
    postalCode: z.string().trim().max(40).optional().or(z.literal("")),
    city: z.string().trim().max(100).optional().or(z.literal("")),
    country: z.string().trim().max(80).optional().or(z.literal("")),

    payoutMethod: z.string().trim().max(40).optional().or(z.literal("")),
    iban: z.string().trim().max(80).optional().or(z.literal("")),
    paypalEmail: z.string().trim().max(180).optional().or(z.literal("")),

    customerMessage: z.string().trim().max(2000).optional().or(z.literal("")),

acceptTerms: z.literal(true),
confirmEnglishNm: z.literal(true),
confirmSorted: z.literal(true),
confirmNoteIncluded: z.literal(true),
  }),
  items: z
    .array(
      z.object({
        cardKey: z.string().trim().min(1),
        qty: z.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(500),
});

function normalizeOptional(value: string | undefined) {
  const clean = (value ?? "").trim();
  return clean ? clean : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid submission data",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { customer } = parsed.data;

    const qtyByCardKey = new Map<string, number>();

    for (const item of parsed.data.items) {
      qtyByCardKey.set(item.cardKey, (qtyByCardKey.get(item.cardKey) ?? 0) + item.qty);
    }

    const cardKeys = Array.from(qtyByCardKey.keys());

    const cards = await prisma.pokemonCard.findMany({
      where: {
        cardKey: { in: cardKeys },
        active: true,
        language: "English",
        condition: "NM",
      },
      include: {
        prices: {
          where: {
            isCurrent: true,
            buyPriceCents: {
              gte: 100,
            },
          },
          orderBy: {
            importedAt: "desc",
          },
          take: 1,
        },
      },
    });

    const lines = cards
      .map((card) => {
        const qty = qtyByCardKey.get(card.cardKey) ?? 0;
        const price = card.prices[0] ?? null;

        if (!price?.buyPriceCents || qty <= 0) return null;

        const unitCents = price.buyPriceCents;
        const lineCents = unitCents * qty;

        return {
          cardKey: card.cardKey,
          cardmarketId: card.cardmarketId,
          cardName: card.name,
          setName: card.setName,
          setCode: card.setCode,
          collectorNumber: card.collectorNumber,
          rarity: card.rarity,
          language: card.language,
          condition: card.condition,
          finishType: card.finishType,
          qty,
          marketPriceCents: price.marketPriceCents,
          unitCents,
          lineCents,
          priceSource: price.source,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    if (lines.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid buylist items found. Prices may have changed.",
        },
        { status: 400 }
      );
    }

    const serverTotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);

    const submission = await prisma.submission.create({
      data: {
        email: customer.email,
        fullName: customer.fullName,
        phone: normalizeOptional(customer.phone),

        addressLine1: normalizeOptional(customer.addressLine1),
        postalCode: normalizeOptional(customer.postalCode),
        city: normalizeOptional(customer.city),
        country: normalizeOptional(customer.country),

        payoutMethod: normalizeOptional(customer.payoutMethod),
        iban: normalizeOptional(customer.iban),
        paypalEmail: normalizeOptional(customer.paypalEmail),

        status: "SUBMITTED",
        subtotalCents: serverTotalCents,
        serverTotalCents,
        clientTotalCents: null,
        currency: "EUR",
        customerMessage: normalizeOptional(customer.customerMessage),
        metaText: JSON.stringify([
          {
            ts: new Date().toISOString(),
            type: "status",
            to: "SUBMITTED",
            message: "Submission created",
          },
        ]),
        items: {
          create: lines.map((line) => ({
            cardKey: line.cardKey,
            cardmarketId: line.cardmarketId,

            cardName: line.cardName,
            setName: line.setName,
            setCode: line.setCode,
            collectorNumber: line.collectorNumber,
            rarity: line.rarity,

            language: line.language,
            condition: line.condition,
            finishType: line.finishType,

            qty: line.qty,
            marketPriceCents: line.marketPriceCents,
            unitCents: line.unitCents,
            lineCents: line.lineCents,
            priceSource: line.priceSource,
          })),
        },
      },
      include: {
        items: true,
      },
    });

        const settings = await getBuylistSettings();

    try {
      if (submission.email) {
        const mail = customerSubmissionConfirmationEmail(submission, settings);

        await sendMail({
          to: submission.email,
          subject: mail.subject,
          html: mail.html,
          replyTo: process.env.MAIL_REPLY_TO ?? process.env.MAIL_ADMIN,
        });
      }
    } catch (mailError) {
      console.warn("[submit buylist] customer mail failed:", mailError);
    }

    try {
      const mail = adminNewSubmissionEmail(submission);

      await sendMail({
        to: process.env.MAIL_ADMIN,
        subject: mail.subject,
        html: mail.html,
        replyTo: submission.email ?? undefined,
      });
    } catch (mailError) {
      console.warn("[submit buylist] admin mail failed:", mailError);
    }

    return NextResponse.json({
      ok: true,
      submissionId: submission.id,
      itemCount: submission.items.reduce((sum, item) => sum + item.qty, 0),
      totalCents: submission.serverTotalCents,
    });
  } catch (error: any) {
    console.error("[submit buylist] failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Submission failed",
      },
      { status: 500 }
    );
  }
}