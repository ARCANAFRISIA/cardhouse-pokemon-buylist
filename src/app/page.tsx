import Link from "next/link";
import { brandName } from "@/lib/env";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <section className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-neutral-950">
              CH
            </div>
            <div>
              <p className="text-sm text-neutral-400">Pokémon Buylist</p>
              <strong>{brandName}</strong>
            </div>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white hover:text-neutral-950"
          >
            Admin
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
            Sell your Pokémon cards
          </p>

          <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-tight md:text-6xl">
            Verkoop je moderne Pokémon hits aan Card House.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600">
            Zoek je kaarten, ontvang direct een indicatieve inkoopprijs en stuur
            je lijst eenvoudig naar ons op. Wij kopen momenteel vooral moderne
            Engelse Near Mint hits uit Sword & Shield, Scarlet & Violet en Mega
            Evolution.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/buy"
              className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
            >
              Start met verkopen
            </Link>

            <a
              href="mailto:info@arcanafrisia.com"
              className="rounded-full border border-neutral-300 px-6 py-3 font-semibold hover:border-neutral-950"
            >
              Vraag stellen
            </a>
          </div>
        </div>

        <div className="rounded-[2rem] border border-neutral-200 bg-neutral-50 p-6 shadow-sm">
          <div className="rounded-[1.5rem] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Wij kopen nu</h2>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-4">
                <span>Series</span>
                <strong>SWSH / SV / ME</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-4">
                <span>Condition</span>
                <strong>NM only</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-4">
                <span>Language</span>
                <strong>English</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 p-4">
                <span>Minimum</span>
                <strong>€1 buy price</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}