"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Settings = {
  generalPayoutPct: number;
  excellentPenaltyPct: number;
  minimumBuyPriceCents: number;
  customerCanShipDirectly: boolean;
  shippingInstructions: string;
  termsText: string;
};

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const json = await res.json();
      setSettings(json.settings);
    }

    load().catch((err) => {
      setError(err?.message ?? "Settings laden mislukt");
    });
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => {
      if (!current) return current;
      return { ...current, [key]: value };
    });
  }

  async function save() {
    if (!settings) return;

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Opslaan mislukt");
      }

      setSettings(json.settings);
      setMessage("Settings opgeslagen");
    } catch (err: any) {
      setError(err?.message ?? "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-white">
        Loading settings...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/admin" className="text-sm text-neutral-400 hover:text-white">
          ← Back to dashboard
        </Link>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            Card House Buylist
          </p>
          <h1 className="mt-3 text-4xl font-bold">Settings</h1>
          <p className="mt-2 text-neutral-400">
            Beheer payout, conditie-aanpassingen, verzendinstructies en voorwaarden.
          </p>
        </div>

        <div className="mt-8 grid gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Pricing</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-neutral-300">
                  Algemene inkoop %
                </span>
                <input
                  type="number"
                  min={1}
                  max={95}
                  value={settings.generalPayoutPct}
                  onChange={(e) =>
                    update("generalPayoutPct", Number(e.target.value))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-300">
                  Excellent penalty %
                </span>
                <input
                  type="number"
                  min={0}
                  max={95}
                  value={settings.excellentPenaltyPct}
                  onChange={(e) =>
                    update("excellentPenaltyPct", Number(e.target.value))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-300">
                  Minimum buy price in centen
                </span>
                <input
                  type="number"
                  min={0}
                  value={settings.minimumBuyPriceCents}
                  onChange={(e) =>
                    update("minimumBuyPriceCents", Number(e.target.value))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
                />
              </label>
            </div>

            <p className="mt-4 text-sm text-neutral-400">
              Nieuwe PowerTools imports gebruiken het algemene inkooppercentage.
              Bestaande submissions blijven als snapshot bewaard.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Shipping</h2>

            <label className="mt-5 flex gap-3 rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm">
              <input
                type="checkbox"
                checked={settings.customerCanShipDirectly}
                onChange={(e) =>
                  update("customerCanShipDirectly", e.target.checked)
                }
                className="mt-1"
              />
              <span>
                Klanten mogen direct opsturen na het indienen van de buylist.
              </span>
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-neutral-300">
                Verzendinstructies
              </span>
              <textarea
                rows={5}
                value={settings.shippingInstructions}
                onChange={(e) =>
                  update("shippingInstructions", e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Terms</h2>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-neutral-300">
                Buylistvoorwaarden
              </span>
              <textarea
                rows={10}
                value={settings.termsText}
                onChange={(e) => update("termsText", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
              />
            </label>
          </div>

          {message && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-2xl bg-red-600 px-6 py-4 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Opslaan..." : "Settings opslaan"}
          </button>
        </div>
      </section>
    </main>
  );
}