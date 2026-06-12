import Link from "next/link";
import { getBuylistSettings } from "@/lib/buylistSettings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TermsPage() {
  const settings = await getBuylistSettings();

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
            Terug
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
            Card House Buylist
          </p>

          <h1 className="mt-4 text-4xl font-black">Buylistvoorwaarden</h1>

          <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
            {settings.termsText}
          </div>
        </div>
      </section>
    </main>
  );
}
<div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700">
  <strong className="text-neutral-950">Verpakking en verzending</strong>
  <p className="mt-2">
    Bekijk ook de verpakkingsguide voordat je je kaarten opstuurt.
  </p>
  <Link
    href="/packing-guide"
    className="mt-3 inline-flex rounded-full bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
  >
    Bekijk verpakkingsguide
  </Link>
</div>