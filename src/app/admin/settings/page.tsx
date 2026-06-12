"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PayoutTier = {
  label: string;
  minCents: number;
  maxCents: number | null;
  payoutPct: number;
};

type BulkCategory = {
  id: string;
  enabled: boolean;
  label: string;
  description: string;
  unitCents: number;
  minQty: number;
  maxQty: number | null;
  sortOrder: number;
};

type Settings = {
  generalPayoutPct: number;
  excellentPenaltyPct: number;
  minimumBuyPriceCents: number;
  customerCanShipDirectly: boolean;
  shippingInstructions: string;
  termsText: string;
  payoutTiers: PayoutTier[];
  bulkCategories: BulkCategory[];
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
  if (!Number.isFinite(n) || n < 0) return fallback;
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
    bulkCategories: Array.isArray(input?.bulkCategories)
      ? input.bulkCategories.map((category: any, index: number) => ({
          id: String(category?.id ?? `BULK_${index + 1}`),
          enabled: Boolean(category?.enabled),
          label: String(category?.label ?? `Bulk ${index + 1}`),
          description: String(category?.description ?? ""),
          unitCents: Number(category?.unitCents ?? 0),
          minQty: Number(category?.minQty ?? 1),
          maxQty:
            category?.maxQty == null || category?.maxQty === ""
              ? null
              : Number(category.maxQty),
          sortOrder: Number(category?.sortOrder ?? index * 10),
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

    load().catch((err) => setError(err?.message ?? "Settings laden mislukt"));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateTier<K extends keyof PayoutTier>(index: number, key: K, value: PayoutTier[K]) {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        payoutTiers: current.payoutTiers.map((tier, tierIndex) =>
          tierIndex === index ? { ...tier, [key]: value } : tier
        ),
      };
    });
  }

  function updateBulk<K extends keyof BulkCategory>(index: number, key: K, value: BulkCategory[K]) {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        bulkCategories: current.bulkCategories.map((category, categoryIndex) =>
          categoryIndex === index ? { ...category, [key]: value } : category
        ),
      };
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
          { label: "", minCents: nextMinCents, maxCents: null, payoutPct: current.generalPayoutPct },
        ],
      };
    });
  }

  function removeTier(index: number) {
    setSettings((current) => {
      if (!current) return current;
      return { ...current, payoutTiers: current.payoutTiers.filter((_, i) => i !== index) };
    });
  }

  function addBulkCategory() {
    setSettings((current) => {
      if (!current) return current;
      const next = current.bulkCategories.length + 1;
      return {
        ...current,
        bulkCategories: [
          ...current.bulkCategories,
          {
            id: `BULK_CUSTOM_${next}`,
            enabled: false,
            label: `Bulk categorie ${next}`,
            description: "",
            unitCents: 10,
            minQty: 1,
            maxQty: null,
            sortOrder: next * 10,
          },
        ],
      };
    });
  }

  function removeBulkCategory(index: number) {
    setSettings((current) => {
      if (!current) return current;
      return { ...current, bulkCategories: current.bulkCategories.filter((_, i) => i !== index) };
    });
  }

  function applyConservativePreset() {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        payoutTiers: [
          { label: "€1 - €10", minCents: 100, maxCents: 1000, payoutPct: 55 },
          { label: "€10 - €50", minCents: 1000, maxCents: 5000, payoutPct: 60 },
          { label: "€50 - €150", minCents: 5000, maxCents: 15000, payoutPct: 65 },
          { label: "€150+", minCents: 15000, maxCents: null, payoutPct: 70 },
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
          maxCents: tier.maxCents == null ? null : Math.max(0, Math.round(tier.maxCents)),
          payoutPct: Math.max(1, Math.min(95, Math.round(tier.payoutPct))),
        })),
        bulkCategories: settings.bulkCategories.map((category, index) => ({
          id: category.id.trim().toUpperCase() || `BULK_${index + 1}`,
          enabled: category.enabled,
          label: category.label.trim() || `Bulk categorie ${index + 1}`,
          description: category.description.trim(),
          unitCents: Math.max(0, Math.round(category.unitCents)),
          minQty: Math.max(1, Math.round(category.minQty)),
          maxQty: category.maxQty == null ? null : Math.max(1, Math.round(category.maxQty)),
          sortOrder: Math.round(category.sortOrder),
        })),
      };

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanSettings),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Opslaan mislukt");

      setSettings(normalizeSettings(json.settings));
      setMessage("Settings opgeslagen");
    } catch (err: any) {
      setError(err?.message ?? "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <main className="min-h-screen bg-neutral-950 p-8 text-white">Loading settings...</main>;
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
            Beheer payout, bulkcategorieën, verzendinstructies en voorwaarden.
          </p>
        </div>

        <div className="mt-8 grid gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Pricing</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-neutral-300">Algemene inkoop %</span>
                <input
                  type="number"
                  min={1}
                  max={95}
                  value={settings.generalPayoutPct}
                  onChange={(e) => update("generalPayoutPct", Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-300">Excellent penalty %</span>
                <input
                  type="number"
                  min={0}
                  max={95}
                  value={settings.excellentPenaltyPct}
                  onChange={(e) => update("excellentPenaltyPct", Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-neutral-300">Minimum buy price in centen</span>
                <input
                  type="number"
                  min={0}
                  value={settings.minimumBuyPriceCents}
                  onChange={(e) => update("minimumBuyPriceCents", Number(e.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Price classes</h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Bepaal het inkooppercentage op basis van de marktprijs uit PowerTools.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={applyConservativePreset} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950">
                  Conservatieve preset
                </button>
                <button type="button" onClick={addTier} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  + Tier toevoegen
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {settings.payoutTiers.map((tier, index) => (
                <div key={`${tier.label}-${index}`} className="grid gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-400">Label</span>
                    <input value={tier.label} onChange={(e) => updateTier(index, "label", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-400">Vanaf €</span>
                    <input type="number" step="0.01" min={0} value={centsToEuroInput(tier.minCents)} onChange={(e) => updateTier(index, "minCents", euroInputToCents(e.target.value, tier.minCents))} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-400">Tot €</span>
                    <input type="number" step="0.01" min={0} value={centsToEuroInput(tier.maxCents)} onChange={(e) => updateTier(index, "maxCents", e.target.value.trim() ? euroInputToCents(e.target.value, tier.maxCents ?? 0) : null)} placeholder="Geen limiet" className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-neutral-400">Inkoop %</span>
                    <input type="number" min={1} max={95} value={tier.payoutPct} onChange={(e) => updateTier(index, "payoutPct", Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                  </label>
                  <div className="flex items-end">
                    <button type="button" onClick={() => removeTier(index)} className="w-full rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10">
                      Verwijder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Bulk buy</h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Deze categorieën verschijnen op de aparte bulkpagina. Zet categorieën uit als Card House ze tijdelijk niet koopt.
                </p>
              </div>
              <button type="button" onClick={addBulkCategory} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                + Bulk categorie
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {settings.bulkCategories.map((category, index) => (
                <div key={`${category.id}-${index}`} className="rounded-2xl border border-white/10 bg-neutral-900 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3 text-sm font-semibold text-neutral-200">
                      <input type="checkbox" checked={category.enabled} onChange={(e) => updateBulk(index, "enabled", e.target.checked)} />
                      Actief op bulkpagina
                    </label>
                    <button type="button" onClick={() => removeBulkCategory(index)} className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/10">
                      Verwijder
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr]">
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">Naam</span>
                      <input value={category.label} onChange={(e) => updateBulk(index, "label", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">Omschrijving</span>
                      <input value={category.description} onChange={(e) => updateBulk(index, "description", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">Code</span>
                      <input value={category.id} onChange={(e) => updateBulk(index, "id", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">Prijs per stuk €</span>
                      <input type="number" step="0.01" min={0} value={centsToEuroInput(category.unitCents)} onChange={(e) => updateBulk(index, "unitCents", euroInputToCents(e.target.value, category.unitCents))} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">Min aantal</span>
                      <input type="number" min={1} value={category.minQty} onChange={(e) => updateBulk(index, "minQty", Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">Max aantal</span>
                      <input type="number" min={1} value={category.maxQty ?? ""} onChange={(e) => updateBulk(index, "maxQty", e.target.value ? Number(e.target.value) : null)} placeholder="Geen" className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-neutral-400">Volgorde</span>
                      <input type="number" value={category.sortOrder} onChange={(e) => updateBulk(index, "sortOrder", Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-white outline-none" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Shipping</h2>
            <label className="mt-5 flex gap-3 rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm">
              <input type="checkbox" checked={settings.customerCanShipDirectly} onChange={(e) => update("customerCanShipDirectly", e.target.checked)} className="mt-1" />
              <span>Klanten mogen direct opsturen na het indienen van de buylist.</span>
            </label>
            <label className="mt-5 block">
              <span className="text-sm font-semibold text-neutral-300">Verzendinstructies</span>
              <textarea rows={5} value={settings.shippingInstructions} onChange={(e) => update("shippingInstructions", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold">Terms</h2>
            <label className="mt-5 block">
              <span className="text-sm font-semibold text-neutral-300">Buylistvoorwaarden</span>
              <textarea rows={10} value={settings.termsText} onChange={(e) => update("termsText", e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            </label>
          </div>

          {message && <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">{message}</div>}
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

          <button type="button" onClick={save} disabled={busy} className="rounded-2xl bg-red-600 px-6 py-4 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? "Opslaan..." : "Settings opslaan"}
          </button>
        </div>
      </section>
    </main>
  );
}
