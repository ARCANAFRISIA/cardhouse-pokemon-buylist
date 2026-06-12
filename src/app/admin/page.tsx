export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

function euro(cents: number) {
  return `€ ${(cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function DashboardCard(props: {
  label: string;
  value: string | number;
  help?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-neutral-400">{props.label}</p>
      <strong className="mt-2 block text-3xl text-white">{props.value}</strong>
      {props.help && <p className="mt-2 text-xs text-neutral-500">{props.help}</p>}
    </div>
  );
}

function ActionCard(props: {
  href: string;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <a
      href={props.href}
      className={[
        "block rounded-2xl border p-5 transition",
        props.primary
          ? "border-red-500/50 bg-red-600 text-white hover:bg-red-700"
          : "border-white/10 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/[0.07]",
      ].join(" ")}
    >
      <strong className="block text-lg">{props.title}</strong>
      <p
        className={[
          "mt-2 text-sm leading-6",
          props.primary ? "text-red-50" : "text-neutral-400",
        ].join(" ")}
      >
        {props.description}
      </p>
    </a>
  );
}

export default async function AdminPage() {
  const openStatuses = ["SUBMITTED", "RECEIVED", "CHECKING", "ADJUSTED"];

  const [openSubmissions, totalSubmissions, catalogCards, onlineCards, openTotal] =
    await Promise.all([
      prisma.submission.count({
        where: {
          status: {
            in: openStatuses,
          },
        },
      }),
      prisma.submission.count(),
      prisma.pokemonCard.count(),
      prisma.pokemonCard.count({
        where: {
          active: true,
          language: "English",
          condition: "NM",
          finishType: "Regular",
          prices: {
            some: {
              isCurrent: true,
              buyPriceCents: {
                gte: 100,
              },
            },
          },
        },
      }),
      prisma.submission.aggregate({
        where: {
          status: {
            in: openStatuses,
          },
        },
        _sum: {
          serverTotalCents: true,
        },
      }),
    ]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            Card House Buylist
          </p>
          <h1 className="mt-3 text-4xl font-bold">Admin dashboard</h1>
          <p className="mt-2 max-w-2xl text-neutral-400">
            Dagelijks overzicht voor Pokémon inkoop. Gebruik de knoppen hieronder
            voor inzendingen, catalogus, prijzen en instellingen.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <DashboardCard
            label="Open inzendingen"
            value={openSubmissions}
            help={`${totalSubmissions} totaal`}
          />
          <DashboardCard
            label="Open uitbetaling"
            value={euro(openTotal._sum.serverTotalCents ?? 0)}
            help="Nog niet betaald"
          />
          <DashboardCard
            label="Kaarten online"
            value={onlineCards}
            help="Zichtbaar op de buylist"
          />
          <DashboardCard
            label="Catalogus"
            value={catalogCards}
            help="Actief en uitgeschakeld samen"
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            href="/admin/submissions"
            title="Inzendingen"
            description="Bekijk nieuwe en open buylists van klanten."
            primary
          />
          <ActionCard
            href="/admin/catalog"
            title="Catalogus & prijzen"
            description="Kaarten aan/uit zetten en PowerTools exports maken."
          />
          <ActionCard
            href="/admin/import"
            title="Prijzen uploaden"
            description="Upload een PowerTools export om de buylist bij te werken."
          />
          <ActionCard
            href="/admin/settings"
            title="Instellingen"
            description="Pas percentages, voorwaarden en verzendtekst aan."
          />
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Snelle workflow</h2>
          <div className="mt-4 grid gap-3 text-sm text-neutral-300 md:grid-cols-3">
            <div className="rounded-xl bg-neutral-900 p-4">
              <strong className="text-white">1. Exporteer naar PowerTools</strong>
              <p className="mt-2 leading-6 text-neutral-400">
                Ga naar Catalogus & prijzen en download een PowerTools CSV.
              </p>
            </div>
            <div className="rounded-xl bg-neutral-900 p-4">
              <strong className="text-white">2. Prijs in PowerTools</strong>
              <p className="mt-2 leading-6 text-neutral-400">
                Laat PowerTools de prijzen zetten en exporteer het resultaat.
              </p>
            </div>
            <div className="rounded-xl bg-neutral-900 p-4">
              <strong className="text-white">3. Upload hier terug</strong>
              <p className="mt-2 leading-6 text-neutral-400">
                Upload via Prijzen uploaden. De buylist wordt direct bijgewerkt.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
