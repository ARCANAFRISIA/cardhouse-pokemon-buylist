// src/lib/mail.ts
export const runtime = "nodejs";

import { Resend } from "resend";

type SendMailArgs = {
  to?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendMail(args: SendMailArgs) {
  const resend = getResendClient();

  if (!resend) {
    console.warn("[mail] skipped: RESEND_API_KEY missing");
    return { skipped: true as const };
  }

  const from = process.env.MAIL_FROM;
  const fallbackTo = process.env.MAIL_ADMIN;

  if (!from) {
    console.warn("[mail] skipped: MAIL_FROM missing");
    return { skipped: true as const };
  }

  const to = args.to ?? fallbackTo;

  if (!to) {
    console.warn("[mail] skipped: no recipient");
    return { skipped: true as const };
  }

  const result = await resend.emails.send({
    from,
    to,
    subject: args.subject,
    html: args.html,
    text: args.text ?? htmlToText(args.html),
    replyTo: args.replyTo,
  });

  console.log("[mail] sent:", {
    to,
    subject: args.subject,
    id: (result as any)?.id ?? null,
  });

  return result;
}

export function euro(cents: number | null | undefined) {
  const n = typeof cents === "number" ? cents : 0;

  return `€ ${(n / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}