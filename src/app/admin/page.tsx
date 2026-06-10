import { prisma } from "@/lib/prisma";
import type { ImportBatch } from "@prisma/client";

function euro(cents: number) {
  return `€ ${(cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AdminPage() {
  const submissions = await prisma.submission.count();
  const cards = await prisma.pokemonCard.count();
  const prices = await prisma.pokemonPrice.count();

  const imports: ImportBatch[] = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const openTotal = await prisma.submission.aggregate({
    where: {
      status: {
        in: ["SUBMITTED", "RECEIVED", "CHECKING", "ADJUSTED"],
      },
    },
    _sum: {
      serverTotalCents: true,
    },
  });

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            Card House Buylist
          </p>
          <h1 className="mt-3 text-4xl font-bold">Admin dashboard</h1>
          <p className="mt-2 text-neutral-400">
            Pokémon inkoop, submissions en prijsimports.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
  <a
    href="/admin/import"
    className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
  >
    Import PowerTools CSV
  </a>
</div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-neutral-400">Submissions</p>
            <strong className="mt-2 block text-3xl">{submissions}</strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-neutral-400">Catalog cards</p>
            <strong className="mt-2 block text-3xl">{cards}</strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-neutral-400">Price rows</p>
            <strong className="mt-2 block text-3xl">{prices}</strong>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-neutral-400">Open value</p>
            <strong className="mt-2 block text-3xl">
              {euro(openTotal._sum.serverTotalCents ?? 0)}
            </strong>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-semibold">Latest imports</h2>

          {imports.length === 0 ? (
            <p className="mt-4 text-neutral-400">No imports yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-neutral-300">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Filename</th>
                    <th className="px-4 py-3">Rows</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((batch) => (
                    <tr key={batch.id} className="border-t border-white/10">
                      <td className="px-4 py-3">{batch.type}</td>
                      <td className="px-4 py-3">{batch.filename ?? "—"}</td>
                      <td className="px-4 py-3">{batch.rowCount}</td>
                      <td className="px-4 py-3">
                        {batch.success ? "Success" : "Failed"}
                      </td>
                      <td className="px-4 py-3">
                        {batch.createdAt.toLocaleString("nl-NL")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}