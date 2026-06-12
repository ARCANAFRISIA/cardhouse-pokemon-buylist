import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const steps = [
  {
    title: "1. Sorteer op volgorde",
    text: "Leg de kaarten in dezelfde volgorde als je ingediende buylist. Dit versnelt de controle.",
    visual: ["BUYLIST", "1", "2", "3"],
  },
  {
    title: "2. Sleeve de kaarten",
    text: "Stop waardevolle kaarten los in sleeves. Bundel niet meerdere kaarten samen in één sleeve.",
    visual: ["CARD", "SLEEVE"],
  },
  {
    title: "3. Bescherm tegen buigen",
    text: "Gebruik een toploader, card saver, stevige kartonnen bescherming of een passende deckbox.",
    visual: ["SLEEVE", "TOPLOADER", "KARTON"],
  },
  {
    title: "4. Houd alles bij elkaar",
    text: "Gebruik een team bag, gripzakje of doosje zodat kaarten niet kunnen schuiven. Gebruik zo min mogelijk tape.",
    visual: ["TEAM BAG", "GEEN TAPE OP KAARTEN"],
  },
  {
    title: "5. Verpak stevig",
    text: "Een bubbelenvelop in een doos of brievenbusdoosje is ideaal. Zorg dat de inhoud niet los beweegt.",
    visual: ["BUBBELENVELOP", "DOOS"],
  },
  {
    title: "6. Voeg een briefje toe",
    text: "Voeg een briefje toe met je naam, e-mailadres en buylistreferentie.",
    visual: ["NAAM", "E-MAIL", "REF"],
  },
];

export default function PackingGuidePage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-neutral-950">
              CH
            </div>
            <div>
              <p className="text-sm text-neutral-400">Pokémon Buylist</p>
              <strong>Card House of the East</strong>
            </div>
          </Link>

          <Link
            href="/submit"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white hover:text-neutral-950"
          >
            Terug naar submit
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
            Verpakkingsguide
          </p>

          <h1 className="mt-4 text-4xl font-black">
            Zo verpak je je Pokémon kaarten
          </h1>

          <p className="mt-4 text-lg leading-8 text-neutral-600">
            Goed verpakken voorkomt schade tijdens verzending en zorgt ervoor
            dat Card House of the East je buylist sneller kan controleren.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {steps.map((step) => (
            <article
              key={step.title}
              className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <div className="rounded-2xl bg-neutral-950 p-5 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  {step.visual.map((label, index) => (
                    <div
                      key={`${step.title}-${label}`}
                      className={[
                        "rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wide",
                        index === 0
                          ? "border-red-500/40 bg-red-500/20 text-red-100"
                          : "border-white/10 bg-white/10 text-neutral-100",
                      ].join(" ")}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <h2 className="mt-5 text-xl font-black">{step.title}</h2>
              <p className="mt-2 leading-7 text-neutral-600">{step.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-green-200 bg-green-50 p-6">
            <h2 className="text-xl font-black text-green-950">Aanrader</h2>
            <p className="mt-3 leading-7 text-green-900">
              Gebruik sleeves, een team bag of gripzakje, en daarna een
              bubbelenvelop in een stevige doos of brievenbusdoosje. Zorg dat
              de kaarten niet kunnen schuiven.
            </p>
          </div>

          <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-black text-red-950">Liever niet</h2>
            <p className="mt-3 leading-7 text-red-900">
              Gebruik geen tape direct op sleeves, toploaders of kaarten.
              Bundel ook niet meerdere kaarten strak samen in één sleeve. Dat
              kost extra verwerkingstijd en kan schade veroorzaken.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">Checklist voor verzending</h2>

          <ul className="mt-4 grid gap-3 text-neutral-700 md:grid-cols-2">
            <li className="rounded-2xl bg-neutral-50 p-4">
              Kaarten liggen op buylistvolgorde.
            </li>
            <li className="rounded-2xl bg-neutral-50 p-4">
              Waardevolle kaarten zitten in sleeves.
            </li>
            <li className="rounded-2xl bg-neutral-50 p-4">
              Kaarten zijn beschermd tegen buigen.
            </li>
            <li className="rounded-2xl bg-neutral-50 p-4">
              Verpakking is stevig en beweegt niet los.
            </li>
            <li className="rounded-2xl bg-neutral-50 p-4">
              Briefje met naam, e-mail en referentie zit erbij.
            </li>
            <li className="rounded-2xl bg-neutral-50 p-4">
              Bij voorkeur verzenden met track & trace.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}