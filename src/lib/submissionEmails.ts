// src/lib/submissionEmails.ts
import type { Submission, SubmissionItem } from "@prisma/client";

import { esc, euro } from "@/lib/mail";
import type { BuylistSettings } from "@/lib/buylistSettings";

type SubmissionWithItems = Submission & {
  items: SubmissionItem[];
};

type ItemChange = {
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
};

function shortRef(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function shell(title: string, body: string) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">${esc(title)}</h2>
      ${body}
      <p style="margin-top:24px">
        Met vriendelijke groet,<br/>
        <strong>Card House of the East</strong>
      </p>
    </div>
  `;
}

function itemRows(items: SubmissionItem[]) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">
            <strong>${esc(item.cardName)}</strong><br/>
            <span style="font-size:12px;color:#666">
              ${esc(item.setName ?? "—")}
              ${item.setCode ? ` · ${esc(item.setCode)}` : ""}
              ${item.collectorNumber ? ` · #${esc(item.collectorNumber)}` : ""}
              · ${esc(item.language)}
              · ${esc(item.condition)}
              · ${esc(item.finishType)}
            </span>
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${item.qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${euro(item.unitCents)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${euro(item.lineCents)}</td>
        </tr>
      `
    )
    .join("");
}

function itemsTable(items: SubmissionItem[], totalCents: number) {
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc">Kaart</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc">Aantal</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc">Stuk</th>
          <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc">Totaal</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows(items)}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right;padding:8px;font-weight:700">Totaal</td>
          <td style="text-align:right;padding:8px;font-weight:700">${euro(totalCents)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function addressBlock(submission: SubmissionWithItems) {
  const lines = [
    submission.fullName,
    submission.addressLine1,
    [submission.postalCode, submission.city].filter(Boolean).join(" "),
    submission.country,
  ].filter(Boolean);

  if (!lines.length) return "—";

  return lines.map((line) => esc(line)).join("<br/>");
}

function payoutBlock(submission: SubmissionWithItems) {
  if (submission.payoutMethod === "BANK") {
    return `Bankoverschrijving<br/>IBAN: ${esc(submission.iban ?? "—")}`;
  }

  if (submission.payoutMethod === "PAYPAL") {
    return `PayPal<br/>${esc(submission.paypalEmail ?? "—")}`;
  }

  return esc(submission.payoutMethod ?? "—");
}

export function customerSubmissionConfirmationEmail(
  submission: SubmissionWithItems,
  settings: BuylistSettings
) {
  const ref = shortRef(submission.id);
  const totalCents = submission.serverTotalCents ?? 0;

  const html = shell(
    `Je Pokémon buylist is ingediend – ${ref}`,
    `
      <p>Bedankt voor je inzending. We hebben je buylist ontvangen met referentie <strong>${esc(ref)}</strong>.</p>

      <p>
        Voorlopig totaal: <strong>${euro(totalCents)}</strong><br/>
        Aantal kaarten: <strong>${submission.items.reduce((sum, item) => sum + item.qty, 0)}</strong>
      </p>

      <p><strong>Belangrijk voor verzending</strong></p>
      <p>${esc(settings.shippingInstructions)}</p>

      <p>
        Controleer nog even dat:
      </p>
      <ul>
        <li>de kaarten English zijn;</li>
        <li>de kaarten Near Mint zijn, tenzij anders afgesproken;</li>
        <li>de kaarten op dezelfde volgorde liggen als de buylist;</li>
        <li>er een briefje bij zit met naam, e-mailadres en referentie <strong>${esc(ref)}</strong>.</li>
      </ul>

      ${itemsTable(submission.items, totalCents)}

      <p style="font-size:12px;color:#666;margin-top:16px">
        Dit is een voorlopige prijsopgave. De definitieve uitbetaling wordt vastgesteld nadat Card House of the East de kaarten heeft gecontroleerd.
      </p>
    `
  );

  return {
    subject: `Pokémon buylist ingediend – ${ref}`,
    html,
  };
}

export function adminNewSubmissionEmail(submission: SubmissionWithItems) {
  const ref = shortRef(submission.id);
  const totalCents = submission.serverTotalCents ?? 0;

  const html = shell(
    `Nieuwe Pokémon buylist – ${ref}`,
    `
      <p>
        Er is een nieuwe Pokémon buylist ingediend.
      </p>

      <p>
        <strong>Referentie:</strong> ${esc(ref)}<br/>
        <strong>Klant:</strong> ${esc(submission.fullName ?? "—")}<br/>
        <strong>E-mail:</strong> ${esc(submission.email ?? "—")}<br/>
        <strong>Telefoon:</strong> ${esc(submission.phone ?? "—")}<br/>
        <strong>Totaal:</strong> ${euro(totalCents)}
      </p>

      <p><strong>Adres</strong><br/>${addressBlock(submission)}</p>

      <p><strong>Uitbetaling</strong><br/>${payoutBlock(submission)}</p>

      ${
        submission.customerMessage
          ? `<p><strong>Bericht klant</strong><br/>${esc(submission.customerMessage)}</p>`
          : ""
      }

      ${itemsTable(submission.items, totalCents)}
    `
  );

  return {
    subject: `Nieuwe Pokémon buylist – ${ref}`,
    html,
  };
}

function statusTitle(status: string) {
  const labels: Record<string, string> = {
    SUBMITTED: "Ingediend",
    RECEIVED: "Ontvangen",
    CHECKING: "Wordt gecontroleerd",
    ADJUSTED: "Aangepast",
    APPROVED: "Goedgekeurd",
    PAID: "Uitbetaald",
    REJECTED: "Afgekeurd",
  };

  return labels[status] ?? status;
}

export function customerStatusEmail(
  submission: SubmissionWithItems,
  status: string,
  message?: string | null
) {
  const ref = shortRef(submission.id);
  const totalCents = submission.serverTotalCents ?? 0;

  const bodyByStatus: Record<string, string> = {
    RECEIVED: `
      <p>We hebben je zending ontvangen. De kaarten worden binnenkort gecontroleerd.</p>
      <p>Referentie: <strong>${esc(ref)}</strong></p>
    `,
    CHECKING: `
      <p>We zijn je kaarten aan het controleren op aantal, versie, taal en conditie.</p>
      <p>Referentie: <strong>${esc(ref)}</strong></p>
    `,
    APPROVED: `
      <p>Je buylist is goedgekeurd.</p>
      <p>Definitief totaal: <strong>${euro(totalCents)}</strong></p>
      <p>We zetten de uitbetaling klaar.</p>
    `,
    PAID: `
      <p>We hebben je buylist uitbetaald.</p>
      <p>Bedrag: <strong>${euro(totalCents)}</strong></p>
    `,
    REJECTED: `
      <p>Je buylist is afgekeurd.</p>
      ${message ? `<p><strong>Toelichting:</strong><br/>${esc(message)}</p>` : ""}
    `,
    ADJUSTED: `
      <p>Je buylist is gecontroleerd en aangepast.</p>
      <p>Nieuw totaal: <strong>${euro(totalCents)}</strong></p>
      ${message ? `<p><strong>Toelichting:</strong><br/>${esc(message)}</p>` : ""}
      <p style="font-size:12px;color:#666">
        Aanpassingen kunnen ontstaan door conditie, taal, versie, aantal of kaarten die niet aan de buylistvoorwaarden voldoen.
      </p>
    `,
  };

  const html = shell(
    `Statusupdate Pokémon buylist – ${ref}`,
    `
      <p>
        Status: <strong>${esc(statusTitle(status))}</strong>
      </p>

      ${bodyByStatus[status] ?? `<p>Je buyliststatus is bijgewerkt naar ${esc(status)}.</p>`}

      ${status !== "REJECTED" ? itemsTable(submission.items, totalCents) : ""}
    `
  );

  return {
    subject: `Statusupdate Pokémon buylist – ${ref}`,
    html,
  };
}

export function customerAdjustedItemsEmail(
  submission: SubmissionWithItems,
  changes: ItemChange[],
  message?: string | null
) {
  const ref = shortRef(submission.id);
  const totalCents = submission.serverTotalCents ?? 0;

  const rows = changes
    .map((change) => {
      const beforeTotal = change.before.lineCents;
      const afterTotal = change.after.lineCents;
      const diff = afterTotal - beforeTotal;

      const diffText =
        diff === 0
          ? euro(0)
          : `${diff > 0 ? "+" : "-"}${euro(Math.abs(diff))}`;

      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top">
            <strong>${esc(change.cardName ?? "Onbekende kaart")}</strong>
            ${
              change.note
                ? `<br/><span style="font-size:12px;color:#666">${esc(change.note)}</span>`
                : ""
            }
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top">
            ${change.before.qty} × ${euro(change.before.unitCents)}
            → ${change.after.qty} × ${euro(change.after.unitCents)}<br/>
            <span style="font-size:12px;color:#666">
              ${esc(change.before.itemStatus)}
              → ${esc(change.after.itemStatus)}
              ${
                change.after.receivedCondition
                  ? ` · ${esc(change.after.receivedCondition)}`
                  : ""
              }
            </span>
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;vertical-align:top">
            ${esc(diffText)}
          </td>
        </tr>
      `;
    })
    .join("");

  const html = shell(
    `Je Pokémon buylist is aangepast – ${ref}`,
    `
      <p>We hebben je kaarten gecontroleerd en één of meer regels aangepast.</p>

      <p>
        Nieuw totaal: <strong>${euro(totalCents)}</strong>
      </p>

      ${message ? `<p><strong>Toelichting:</strong><br/>${esc(message)}</p>` : ""}

      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc">Kaart</th>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ccc">Aanpassing</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ccc">Verschil</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="font-size:12px;color:#666;margin-top:16px">
        De originele buylist-prijzen blijven leidend. Aanpassingen komen alleen door controle op aantal, conditie, taal of kaartversie.
      </p>
    `
  );

  return {
    subject: `Pokémon buylist aangepast – ${ref}`,
    html,
  };
}