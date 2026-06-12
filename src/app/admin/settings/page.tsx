"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PayoutTier = {
  label: string;
  minCents: number;
  maxCents: number | null;
  payoutPct: number;
};

type Settings = {
  generalPayoutPct: number;
  excellentPenaltyPct: number;
  minimumBuyPriceCents: number;
  customerCanShipDirectly: boolean;
  shippingInstructions: string;
  termsText: string;
  payoutTiers: PayoutTier[];
};

export const dynamic = "force-dynamic";

function centsToEuroInput(cents: number | null | undefined) {
  if (cents == null) return "";
  return String(cents / 100);
}

function euroInputToCents(value: string, fallback = 0) {
  const clean = value.replace(",", ".").trim();

  if (!clean) return fallback;

  const n = Number(clean);

  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }

  return Math.round(n * 100);
}

function normalizeSettings(input: any): Settings {
  return {
    generalPayoutPct: Number(input?.generalPayoutPct ?? 70),
    excellentPenaltyPct: Number(input?.excellentPenaltyPct ?? 30),
    minimumBuyPriceCents: Number(input?.minimumBuyPriceCents ?? 100),
    customerCanShipDirectly: Boolean(input?.customerCanShipDirectly ?? true),
    shippingInstructions: String(input?.shippingInstructions ?? ""),
    termsText: String(input?.termsText ?? ""),
    payoutTiers: Array.isArray(input?.payoutTiers)
      ? input.payoutTiers.map((tier: any, index: number) => ({
          label: String(tier?.label ?? `Tier ${index + 1}`),
          minCents: Number(tier?.minCents ?? 0),
          maxCents:
            tier?.maxCents == null || tier?.maxCents === ""
              ? null
              : Number(tier.maxCents),
          payoutPct: Number(tier?.payoutPct ?? input?.generalPayoutPct ?? 70),
        }))
      : [],
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const json = await res.json();

      setSettings(normalizeSettings(json.settings));
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

  function updateTier<K extends keyof PayoutTier>(
    index: number,
    key: K,
    value: PayoutTier[K]
  ) {
    setSettings((current) => {
      if (!current) return current;

      const payoutTiers = current.payoutTiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [key]: value } : tier
      );

      return { ...current, payoutTiers };
    });
  }

  function addTier() {
    setSettings((current) => {
      if (!current) return current;

      const lastTier = current.payoutTiers[current.payoutTiers.length - 1];
      const nextMinCents = lastTier?.maxCents ?? 0;

      return {
        ...current,
        payoutTiers: [
          ...current.payoutTiers,
          {
            label: "",
            minCents: nextMinCents,
            maxCents: null,
            payoutPct: current.generalPayoutPct,
          },
        ],
      };
    });
  }

  function removeTier(index: number) {
    setSettings((current) => {
      if (!current) return current;

      return {
        ...current,
        payoutTiers: current.payoutTiers.filter((_, tierIndex) => tierIndex !== index),
      };
    });
  }

  function applyConservativePreset() {
    setSettings((current) => {
      if (!current) return current;

      return {
        ...current,
        payoutTiers: [
          {
            label: "€1 - €10",
            minCents: 100,
            maxCents: 1000,
            payoutPct: 60,
          },
          {
            label: "€10 - €50",
            minCents: 1000,
            maxCents: 5000,
            payoutPct: 65,
          },
          {
            label: "€50 - €150",
            minCents: 5000,
            maxCents: 15000,
            payoutPct: 70,
          },
          {
            label: "€150+",
            minCents: 15000,
            maxCents: null,
            payoutPct: 75,
          },
        ],
      };
    });
  }

  async function save() {
    if (!settings) return;

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const cleanSettings: Settings = {
        ...settings,
        payoutTiers: settings.payoutTiers.map((tier, index) => ({
          label: tier.label.trim() || `Tier ${index + 1}`,
          minCents: Math.max(0, Math.round(tier.minCents)),
          maxCents:
            tier.maxCents == null ? null : Math.max(0, Math.round(tier.maxCents)),
          payoutPct: Math.max(1, Math.min(95, Math.round(tier.payoutPct))),
        })),
      };

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanSettings),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Opslaan mislukt");
      }

      setSettings(normalizeSettings(json.settings));
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
              Nieuwe PowerTools imports gebruiken eerst de price classes hieronder.
              Als er geen passende price class is, valt het systeem terug op het
              algemene inkooppercentage. Bestaande submissions blijven als snapshot
              bewaard.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Price classes</h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Bepaal het inkooppercentage op basis van de marktprijs uit de
                  PowerTools import.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyConservativePreset}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950"
                >
                  Conservatieve preset
                </button>

                <button
                  type="button"
                  onClick={addTier}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  + Tier toevoegen
                </button>
              </div>
            </div>

            {settings.payoutTiers.length === 0 ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">
                Geen price classes ingesteld. Het systeem gebruikt nu overal het
                algemene inkooppercentage van {settings.generalPayoutPct}%.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {settings.payoutTiers.map((tier, index) => (
                  <div
                    key={`${tier.label}-${index}`}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
                  >
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">
                        Label
                      </span>
                      <input
                        value={tier.label}
                        onChange={(e) =>
                          updateTier(index, "label", e.target.value)
                        }
                        placeholder={`Tier ${index + 1}`}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">
                        Vanaf €
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={centsToEuroInput(tier.minCents)}
                        onChange={(e) =>
                          updateTier(
                            index,
                            "minCents",
                            euroInputToCents(e.target.value, tier.minCents)
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">
                        Tot €
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={centsToEuroInput(tier.maxCents)}
                        onChange={(e) =>
                          updateTier(
                            index,
                            "maxCents",
                            e.target.value.trim()
                              ? euroInputToCents(e.target.value, tier.maxCents ?? 0)
                              : null
                          )
                        }
                        placeholder="Geen limiet"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">
                        Inkoop %
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={95}
                        value={tier.payoutPct}
                        onChange={(e) =>
                          updateTier(index, "payoutPct", Number(e.target.value))
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeTier(index)}
                        className="w-full rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10"
                      >
                        Verwijder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-400">
              Voorbeeld: een kaart met marktprijs €25 valt in de class €10 - €50.
              Staat daar 65%, dan wordt de buy price €16,25. De import slaat dat
              percentage ook op bij de prijsregel.
            </div>
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