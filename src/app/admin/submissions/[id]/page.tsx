import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SubmissionStatusEditor from "@/components/admin/SubmissionStatusEditor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function euro(cents: number | null | undefined) {
  if (cents == null) return "—";

  return `€ ${(cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortRef(id: string) {
  return id.slice(0, 8);
}

type StatusEvent = {
  ts?: string;
  type?: string;
  from?: string | null;
  to?: string;
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

export default async function AdminSubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!submission) {
    notFound();
  }

  const cardCount = submission.items.reduce((sum, item) => sum + item.qty, 0);
const events = parseMetaEvents(submission.metaText);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/submissions"
            className="text-sm text-neutral-400 hover:text-white"
          >
            ← Back to submissions
          </Link>

          <Link
            href="/admin"
            className="text-sm text-neutral-400 hover:text-white"
          >
            Dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
                Submission {shortRef(submission.id)}
              </p>
              <h1 className="mt-3 text-4xl font-bold">
                {submission.fullName ?? "Unknown customer"}
              </h1>
              <p className="mt-2 text-neutral-400">
                {submission.email ?? "No email"} · {cardCount} cards ·{" "}
                {euro(submission.serverTotalCents)}
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-neutral-300">
                  <tr>
                    <th className="px-4 py-3">Card</th>
                    <th className="px-4 py-3">Set</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Line</th>
                  </tr>
                </thead>

                <tbody>
                  {submission.items.map((item) => (
                    <tr key={item.id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{item.cardName}</div>
                        <div className="text-xs text-neutral-400">
                          {item.rarity ?? "—"} · {item.language} ·{" "}
                          {item.condition} · {item.finishType}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          CM {item.cardmarketId}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-300">
                        {item.setName ?? "—"}
                        {item.setCode ? ` · ${item.setCode}` : ""}
                        {item.collectorNumber
                          ? ` · #${item.collectorNumber}`
                          : ""}
                      </td>
                      <td className="px-4 py-3">{item.qty}</td>
                      <td className="px-4 py-3">{euro(item.unitCents)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {euro(item.lineCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
                        {events.length > 0 && (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-xl font-bold">History</h2>

                <div className="mt-4 space-y-3">
                  {events
                    .slice()
                    .reverse()
                    .map((event, index) => (
                      <div
                        key={`${event.ts}-${index}`}
                        className="rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm"
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <strong>
                            {event.from ? `${event.from} → ${event.to}` : event.to}
                          </strong>
                          <span className="text-neutral-400">
                            {event.ts
                              ? new Date(event.ts).toLocaleString("nl-NL")
                              : "—"}
                          </span>
                        </div>

                        {event.message && (
                          <p className="mt-2 whitespace-pre-wrap text-neutral-300">
                            {event.message}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>

         <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
  <SubmissionStatusEditor
    submissionId={submission.id}
    currentStatus={submission.status}
  />

  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-bold">Customer</h2>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-400">Status</span>
                  <strong>{submission.status}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-400">Total</span>
                  <strong>{euro(submission.serverTotalCents)}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-400">Cards</span>
                  <strong>{cardCount}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-400">Created</span>
                  <strong>{submission.createdAt.toLocaleString("nl-NL")}</strong>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="font-bold">Contact</h3>
                <div className="mt-3 space-y-2 text-sm text-neutral-300">
                  <p>{submission.fullName ?? "—"}</p>
                  <p>{submission.email ?? "—"}</p>
                  <p>{submission.phone ?? "—"}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="font-bold">Address</h3>
                <div className="mt-3 space-y-2 text-sm text-neutral-300">
                  <p>{submission.addressLine1 ?? "—"}</p>
                  <p>
                    {submission.postalCode ?? ""} {submission.city ?? ""}
                  </p>
                  <p>{submission.country ?? "—"}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="font-bold">Payout</h3>
                <div className="mt-3 space-y-2 text-sm text-neutral-300">
                  <p>{submission.payoutMethod ?? "—"}</p>
                  <p>{submission.iban ?? submission.paypalEmail ?? "—"}</p>
                </div>
              </div>

              {submission.customerMessage && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h3 className="font-bold">Message</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">
                    {submission.customerMessage}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}