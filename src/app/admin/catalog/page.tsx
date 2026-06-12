"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Batch = {
  id: string;
  type: string;
  rowCount: number;
  success: boolean;
  message: string | null;
  createdAt: string;
};

type Stats = {
  ok: boolean;
  totalCards: number;
  activeCards: number;
  inactiveCards: number;
  pricedCards: number;
  unpricedCards: number;
  currentPriceRows: number;
  visibleBuylistCards: number;
  minimumBuyPriceCents: number;
  recentBatches: Batch[];
  error?: string;
};

type ImportResult = {
  ok: boolean;
  dryRun?: boolean;
  batchId?: string | null;
  expansionCount?: number;
  requestedExpansionIds?: number[];
  fetchedProducts?: number;
  eligibleProducts?: number;
  upsertedCards?: number;
  skippedInvalid?: number;
  skippedRarity?: number;
  skippedLanguage?: number;
  skippedExpansionLanguage?: number;
  skippedNoEnglishTcgSet?: number;
  skippedNoTcgCardMatch?: number;
  matchedEnglishSetCount?: number;
  errors?: Array<{ idExpansion: number; name: string | null; error: string }>;
  error?: string;
};

type CatalogCard = {
  id: string;
  cardKey: string;
  cardmarketId: number;
  name: string;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  series: string | null;
  language: string;
  condition: string;
  finishType: string;
  imageUrl: string | null;
  active: boolean;
  hasImage: boolean;
  visibleOnBuylist: boolean;
  marketPrice: number | null;
  buyPrice: number | null;
  payoutPct: number | null;
  priceSource: string | null;
  importedAt: string | null;
  updatedAt: string;
};

type CardsResult = {
  ok: boolean;
  count?: number;
  items?: CatalogCard[];
  error?: string;
};

function euro(value: number | null | undefined) {
  if (value == null) return "—";

  return `€ ${value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function euroCents(cents: number) {
  return euro(cents / 100);
}

function StatCard(props: { label: string; value: string | number; help?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-neutral-400">{props.label}</p>
      <strong className="mt-2 block text-3xl text-white">{props.value}</strong>
      {props.help && <p className="mt-2 text-xs text-neutral-500">{props.help}</p>}
    </div>
  );
}

function CardThumb(props: { card: CatalogCard }) {
  if (!props.card.imageUrl) {
    return (
      <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-[9px] font-bold text-neutral-600">
        NO IMG
      </div>
    );
  }

  return (
    <img
      src={props.card.imageUrl}
      alt={props.card.name}
      loading="lazy"
      className="h-16 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
    />
  );
}

export default function AdminCatalogPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsBusy, setStatsBusy] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [limitExpansions, setLimitExpansions] = useState(10);
  const [expansionIds, setExpansionIds] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [cardsBusy, setCardsBusy] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("all");
  const [catalogSetCode, setCatalogSetCode] = useState("");
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);

  const exportQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (catalogQuery.trim().length >= 2) params.set("q", catalogQuery.trim());
    return params.toString();
  }, [catalogQuery]);

  async function loadStats() {
    setStatsBusy(true);

    try {
      const res = await fetch("/api/admin/catalog/stats", { cache: "no-store" });
      const json = (await res.json()) as Stats;
      setStats(json);
    } catch (error: any) {
      setStats({
        ok: false,
        totalCards: 0,
        activeCards: 0,
        inactiveCards: 0,
        pricedCards: 0,
        unpricedCards: 0,
        currentPriceRows: 0,
        visibleBuylistCards: 0,
        minimumBuyPriceCents: 100,
        recentBatches: [],
        error: error?.message ?? "Could not load stats",
      });
    } finally {
      setStatsBusy(false);
    }
  }

  async function loadCards() {
    setCardsBusy(true);
    setCardsError(null);

    try {
      const params = new URLSearchParams();
      params.set("status", catalogStatus);
      params.set("limit", "100");
      if (catalogQuery.trim().length >= 2) params.set("q", catalogQuery.trim());
      if (catalogSetCode.trim()) params.set("setCode", catalogSetCode.trim());

      const res = await fetch(`/api/admin/catalog/cards?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as CardsResult;

      if (!json.ok) {
        throw new Error(json.error ?? "Could not load catalog cards");
      }

      setCards(json.items ?? []);
    } catch (error: any) {
      setCardsError(error?.message ?? "Could not load catalog cards");
      setCards([]);
    } finally {
      setCardsBusy(false);
    }
  }

  async function runImport(dryRun: boolean) {
    setImportBusy(true);
    setImportResult(null);

    try {
      const params = new URLSearchParams();

      if (expansionIds.trim()) {
        params.set("ids", expansionIds.trim());
      } else {
        params.set("limitExpansions", String(limitExpansions));
      }

      if (dryRun) params.set("dryRun", "1");

      const res = await fetch(`/api/admin/catalog/import-cardmarket?${params.toString()}`, {
        method: "POST",
      });
      const json = (await res.json()) as ImportResult;
      setImportResult(json);
      await loadStats();
      await loadCards();
    } catch (error: any) {
      setImportResult({ ok: false, dryRun, error: error?.message ?? "Import failed" });
    } finally {
      setImportBusy(false);
    }
  }

  async function setCardActive(card: CatalogCard, active: boolean) {
    setToggleBusyId(card.id);

    try {
      const res = await fetch(`/api/admin/catalog/cards/${card.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error ?? "Could not update card");
      }

      setCards((current) =>
        current.map((item) => (item.id === card.id ? { ...item, active } : item))
      );
      await loadStats();
    } catch (error: any) {
      alert(error?.message ?? "Could not update card");
    } finally {
      setToggleBusyId(null);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadCards, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogQuery, catalogStatus, catalogSetCode]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <Link href="/admin" className="text-sm text-neutral-400 hover:text-white">
          ← Back to dashboard
        </Link>

        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
              Catalog
            </p>
            <h1 className="mt-3 text-4xl font-bold">Pokémon catalog</h1>
            <p className="mt-2 max-w-2xl text-neutral-400">
              Import modern Cardmarket Pokémon hits, export to PowerTools, and control which cards are visible on the public buylist.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              loadStats();
              loadCards();
            }}
            disabled={statsBusy || cardsBusy}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950 disabled:opacity-50"
          >
            {statsBusy || cardsBusy ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {stats?.ok === false && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {stats.error}
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Catalog cards" value={stats?.totalCards ?? "—"} />
          <StatCard label="Active cards" value={stats?.activeCards ?? "—"} />
          <StatCard label="Priced cards" value={stats?.pricedCards ?? "—"} />
          <StatCard
            label="Visible on buylist"
            value={stats?.visibleBuylistCards ?? "—"}
            help={stats ? `Minimum buy price: ${euroCents(stats.minimumBuyPriceCents)}` : undefined}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-bold">Catalog overview</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Search, verify images/prices and disable bad cards without SQL. Disabled cards stay in the catalog but disappear from PowerTools export and /buy.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_160px_150px]">
                <input
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="Search name, set, collector number or CM ID"
                  className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                />
                <input
                  value={catalogSetCode}
                  onChange={(event) => setCatalogSetCode(event.target.value)}
                  placeholder="Set code"
                  className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                />
                <select
                  value={catalogStatus}
                  onChange={(event) => setCatalogStatus(event.target.value)}
                  className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="priced">Priced</option>
                  <option value="unpriced">Unpriced</option>
                </select>
              </div>

              {cardsError && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                  {cardsError}
                </div>
              )}

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-400">
                  <span>{cardsBusy ? "Loading cards..." : `${cards.length} cards shown`}</span>
                  <span>Showing max 100 rows</span>
                </div>

                <div className="divide-y divide-white/10">
                  {cards.length === 0 && !cardsBusy ? (
                    <div className="p-6 text-center text-sm text-neutral-500">
                      No cards found.
                    </div>
                  ) : (
                    cards.map((card) => (
                      <div
                        key={card.id}
                        className="grid gap-4 bg-neutral-950/40 p-4 md:grid-cols-[auto_1fr_auto] md:items-center"
                      >
                        <CardThumb card={card} />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-white">{card.name}</strong>
                            <span
                              className={[
                                "rounded-full px-2 py-1 text-xs font-bold",
                                card.active
                                  ? "bg-green-500/15 text-green-200"
                                  : "bg-neutral-700 text-neutral-300",
                              ].join(" ")}
                            >
                              {card.active ? "Active" : "Inactive"}
                            </span>
                            {card.visibleOnBuylist && (
                              <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs font-bold text-red-100">
                                On buylist
                              </span>
                            )}
                            {!card.hasImage && (
                              <span className="rounded-full bg-yellow-500/15 px-2 py-1 text-xs font-bold text-yellow-100">
                                No image
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-neutral-400">
                            {card.setName ?? "Unknown set"}
                            {card.setCode ? ` • ${card.setCode}` : ""}
                            {card.collectorNumber ? ` • #${card.collectorNumber}` : ""}
                            {card.rarity ? ` • ${card.rarity}` : ""}
                          </p>

                          <p className="mt-1 text-xs text-neutral-500">
                            CM {card.cardmarketId} • {card.language} • {card.condition} • {card.finishType}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-4 md:justify-end">
                          <div className="text-right text-sm">
                            <p className="text-neutral-500">Market</p>
                            <strong>{euro(card.marketPrice)}</strong>
                            <p className="mt-1 text-neutral-500">Buy</p>
                            <strong>{euro(card.buyPrice)}</strong>
                          </div>

                          <button
                            type="button"
                            disabled={toggleBusyId === card.id}
                            onClick={() => setCardActive(card, !card.active)}
                            className={[
                              "rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50",
                              card.active
                                ? "border border-white/15 text-neutral-200 hover:bg-white hover:text-neutral-950"
                                : "bg-red-600 text-white hover:bg-red-700",
                            ].join(" ")}
                          >
                            {toggleBusyId === card.id
                              ? "Saving..."
                              : card.active
                              ? "Disable"
                              : "Enable"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-2xl font-bold">Import from Cardmarket</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Use small batches. Cardmarket is used for product IDs; the Pokémon TCG/Scrydex set cache is used to avoid Asian-language product lines.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-neutral-300">
                    Number of newest expansions
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={75}
                    value={limitExpansions}
                    onChange={(event) => setLimitExpansions(Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-neutral-300">
                    Or specific expansion IDs
                  </span>
                  <input
                    value={expansionIds}
                    onChange={(event) => setExpansionIds(event.target.value)}
                    placeholder="Example: 2916,1564"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-red-500"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => runImport(true)}
                  disabled={importBusy}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950 disabled:opacity-50"
                >
                  Dry run
                </button>

                <button
                  type="button"
                  onClick={() => runImport(false)}
                  disabled={importBusy}
                  className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {importBusy ? "Importing..." : "Import catalog"}
                </button>
              </div>

              {importResult && (
                <div
                  className={[
                    "mt-6 rounded-2xl border p-4 text-sm",
                    importResult.ok
                      ? "border-green-500/30 bg-green-500/10 text-green-100"
                      : "border-red-500/30 bg-red-500/10 text-red-100",
                  ].join(" ")}
                >
                  <strong>
                    {importResult.ok
                      ? importResult.dryRun
                        ? "Dry run complete"
                        : "Import complete"
                      : importResult.dryRun
                      ? "Dry run failed"
                      : "Import failed"}
                  </strong>

                  {importResult.error ? (
                    <p className="mt-2 whitespace-pre-wrap">{importResult.error}</p>
                  ) : (
                    <div className="mt-3 grid gap-1 text-sm">
                      <p>Dry run: {importResult.dryRun ? "yes" : "no"}</p>
                      <p>Expansions imported/checking: {importResult.expansionCount ?? 0}</p>
                      <p>Matched official English sets: {importResult.matchedEnglishSetCount ?? 0}</p>
                      <p>Skipped no official English TCG set: {importResult.skippedNoEnglishTcgSet ?? 0}</p>
                      <p>Skipped no matching English TCG card: {importResult.skippedNoTcgCardMatch ?? 0}</p>
                      <p>Fetched products: {importResult.fetchedProducts ?? 0}</p>
                      <p>Eligible hits: {importResult.eligibleProducts ?? 0}</p>
                      <p>Upserted cards: {importResult.upsertedCards ?? 0}</p>
                      <p>Skipped by rarity: {importResult.skippedRarity ?? 0}</p>
                      <p>Skipped by language/set: {importResult.skippedLanguage ?? 0}</p>
                      <p>Skipped invalid: {importResult.skippedInvalid ?? 0}</p>
                      {(importResult.errors?.length ?? 0) > 0 && (
                        <div className="mt-3 rounded-xl border border-red-400/25 bg-red-950/30 p-3">
                          <p className="font-semibold">
                            Expansion errors: {importResult.errors?.length}
                          </p>
                          <div className="mt-2 space-y-2 text-xs leading-5 text-red-100">
                            {importResult.errors?.slice(0, 8).map((error) => (
                              <div key={`${error.idExpansion}-${error.error}`}>
                                <strong>
                                  {error.name ?? "Unknown expansion"} ({error.idExpansion})
                                </strong>
                                <p className="mt-1 break-words text-red-100/80">
                                  {error.error}
                                </p>
                              </div>
                            ))}
                            {(importResult.errors?.length ?? 0) > 8 && (
                              <p>Only the first 8 errors are shown.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">PowerTools export</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Export active English NM Regular cards. Use the normal export for PowerTools autoprice. Only upload the PowerTools result back after prices were replaced.
              </p>

              <div className="mt-5 grid gap-3">
                <a
                  href={`/api/admin/catalog/export-powertools${exportQueryString ? `?${exportQueryString}` : ""}`}
                  className="block rounded-full bg-red-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-red-700"
                >
                  Download PowerTools CSV
                </a>

                <a
                  href={`/api/admin/catalog/export-powertools?onlyUnpriced=1${exportQueryString ? `&${exportQueryString}` : ""}`}
                  className="block rounded-full border border-white/15 px-5 py-3 text-center text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950"
                >
                  Download only unpriced
                </a>

                <a
                  href={`/api/admin/catalog/export-powertools?useCurrentPrices=1${exportQueryString ? `&${exportQueryString}` : ""}`}
                  className="block rounded-full border border-white/15 px-5 py-3 text-center text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950"
                >
                  Download with current prices
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">Recent imports</h2>

              <div className="mt-4 space-y-3">
                {stats?.recentBatches?.length ? (
                  stats.recentBatches.map((batch) => (
                    <div key={batch.id} className="rounded-xl bg-neutral-900 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{batch.type}</strong>
                        <span
                          className={[
                            "rounded-full px-2 py-1 text-xs font-bold",
                            batch.success
                              ? "bg-green-500/15 text-green-200"
                              : "bg-red-500/15 text-red-200",
                          ].join(" ")}
                        >
                          {batch.success ? "OK" : "Failed"}
                        </span>
                      </div>
                      <p className="mt-2 text-neutral-400">{batch.message ?? "—"}</p>
                      <p className="mt-2 text-xs text-neutral-500">
                        {new Date(batch.createdAt).toLocaleString("nl-NL")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500">No catalog imports yet.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
