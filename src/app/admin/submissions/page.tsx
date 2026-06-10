import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SubmissionRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  status: string;
  serverTotalCents: number;
  createdAt: Date;
  items: {
    qty: number;
  }[];
};

function euro(cents: number) {
  return `€ ${(cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortRef(id: string) {
  return id.slice(0, 8);
}

function statusClass(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "bg-blue-500/10 text-blue-200 border-blue-500/30";
    case "RECEIVED":
      return "bg-purple-500/10 text-purple-200 border-purple-500/30";
    case "CHECKING":
      return "bg-yellow-500/10 text-yellow-200 border-yellow-500/30";
    case "ADJUSTED":
      return "bg-orange-500/10 text-orange-200 border-orange-500/30";
    case "APPROVED":
      return "bg-green-500/10 text-green-200 border-green-500/30";
    case "PAID":
      return "bg-emerald-500/10 text-emerald-200 border-emerald-500/30";
    case "REJECTED":
      return "bg-red-500/10 text-red-200 border-red-500/30";
    default:
      return "bg-white/10 text-neutral-200 border-white/20";
  }
}

export default async function AdminSubmissionsPage() {
  const submissions = (await prisma.submission.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: {
        select: {
          qty: true,
        },
      },
    },
  })) as SubmissionRow[];

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/admin" className="text-sm text-neutral-400 hover:text-white">
          ← Back to dashboard
        </Link>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            Card House Buylist
          </p>
          <h1 className="mt-3 text-4xl font-bold">Submissions</h1>
          <p className="mt-2 text-neutral-400">
            Ingestuurde Pokémon buylists.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {submissions.length === 0 ? (
            <div className="p-8 text-neutral-400">No submissions yet.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-neutral-300">
                <tr>
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Cards</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody>
                {submissions.map((submission) => {
                  const cardCount = submission.items.reduce(
                    (sum, item) => sum + item.qty,
                    0
                  );

                  return (
                    <tr key={submission.id} className="border-t border-white/10">
                      <td className="px-4 py-3 font-mono text-neutral-300">
                        {shortRef(submission.id)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {submission.fullName ?? "Unknown"}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {submission.email ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{cardCount}</td>
                      <td className="px-4 py-3 font-semibold">
                        {euro(submission.serverTotalCents)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex rounded-full border px-3 py-1 text-xs font-bold",
                            statusClass(submission.status),
                          ].join(" ")}
                        >
                          {submission.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-300">
                        {submission.createdAt.toLocaleString("nl-NL")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/submissions/${submission.id}`}
                          className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}