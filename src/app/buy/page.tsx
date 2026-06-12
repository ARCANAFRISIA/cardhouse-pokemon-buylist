"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SearchItem = {
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
  marketPrice: number | null;
  buyPrice: number | null;
  priceSource: string | null;
};

type CartItem = SearchItem & {
  qty: number;
};

type FilterSet = {
  setCode: string;
  label: string;
};

type SearchResponse = {
  ok: boolean;
  items?: SearchItem[];
  filters?: {
    sets?: FilterSet[];
    rarities?: string[];
  };
};

function euro(value: number | null) {
  if (value == null) return "—";

  return `€ ${value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function lineTotal(item: CartItem) {
  return (item.buyPrice ?? 0) * item.qty;
}

function CardImage(props: { item: Pick<SearchItem, "name" | "imageUrl">; size?: "sm" | "md" }) {
  const sizeClass = props.size === "sm" ? "h-14 w-10" : "h-24 w-[4.25rem] sm:h-28 sm:w-20";

  if (!props.item.imageUrl) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 text-[10px] font-bold text-neutral-400`}
      >
        NO IMG
      </div>
    );
  }

  return (
    <img
      src={props.item.imageUrl}
      alt={props.item.name}
      loading="lazy"
      className={`${sizeClass} shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-neutral-200`}
    />
  );
}

export default function BuyPage() {
  const [q, setQ] = useState("");
  const [setCode, setSetCode] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [sort, setSort] = useState("name-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [setOptions, setSetOptions] = useState<FilterSet[]>([]);
  const [rarityOptions, setRarityOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + lineTotal(item), 0);
  const hasActiveFilters = setCode !== "all" || rarity !== "all" || sort !== "name-asc";

  const searchLabel = useMemo(() => {
    if (loading) return "Zoeken...";
    if (items.length === 0) return "Geen kaarten gevonden";
    return `${items.length} kaart${items.length === 1 ? "" : "en"} gevonden`;
  }, [loading, items.length]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("cardhouse-buylist-cart");
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load cart", error);
    } finally {
      setCartLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;

    window.localStorage.setItem("cardhouse-buylist-cart", JSON.stringify(cart));
  }, [cart, cartLoaded]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (q.trim().length >= 2) params.set("q", q.trim());
        if (setCode !== "all") params.set("setCode", setCode);
        if (rarity !== "all") params.set("rarity", rarity);
        if (sort !== "name-asc") params.set("sort", sort);
        params.set("t", Date.now().toString());

        const res = await fetch(`/api/cards/search?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        const json = (await res.json()) as SearchResponse;
        setItems(json.items ?? []);
        setSetOptions(json.filters?.sets ?? []);
        setRarityOptions(json.filters?.rarities ?? []);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Search failed", error);
        }
      } finally {
        setLoading(false);
      }
    }

    const timer = window.setTimeout(load, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, setCode, rarity, sort]);

  function addToCart(item: SearchItem) {
    if (!item.buyPrice || item.buyPrice <= 0) return;

    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.cardKey === item.cardKey);

      if (existing) {
        return current.map((cartItem) =>
          cartItem.cardKey === item.cardKey
            ? { ...cartItem, qty: cartItem.qty + 1 }
            : cartItem
        );
      }

      return [...current, { ...item, qty: 1 }];
    });
  }

  function changeQty(cardKey: string, delta: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.cardKey === cardKey ? { ...item, qty: item.qty + delta } : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  function removeFromCart(cardKey: string) {
    setCart((current) => current.filter((item) => item.cardKey !== cardKey));
  }

  function clearCart() {
    setCart([]);
  }

  function resetFilters() {
    setSetCode("all");
    setRarity("all");
    setSort("name-asc");
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
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
            href="/bulk"
            className="hidden rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white hover:text-neutral-950 sm:inline-flex"
          >
            Bulk buy
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 md:grid-cols-[1fr_320px] md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
                Pokémon Buylist
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Verkoop je Pokémon kaarten
              </h1>
              <p className="mt-4 max-w-2xl text-neutral-600">
                Zoek je kaart, voeg hem toe aan je buylist en dien je lijst online in.
                De definitieve uitbetaling wordt vastgesteld na controle.
              </p>
            </div>

            <div className="rounded-2xl bg-neutral-50 p-4 text-sm">
              <div className="flex justify-between">
                <span>Condition</span>
                <strong>NM only</strong>
              </div>
              <div className="mt-3 flex justify-between">
                <span>Language</span>
                <strong>English</strong>
              </div>
              <div className="mt-3 flex justify-between">
                <span>Minimum</span>
                <strong>€1 buy price</strong>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div>
              <strong>Goedkope ex/V/VMAX/VSTAR bulk?</strong>
              <p className="mt-1 text-sm text-neutral-600">
                Gebruik bulk buy voor kaarten die je niet los wilt opzoeken.
              </p>
            </div>
            <Link
              href="/bulk"
              className="mt-4 inline-flex rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 sm:mt-0"
            >
              Naar bulk buy
            </Link>
          </div>

          <div className="mt-8">
            <label className="text-sm font-semibold text-neutral-700">
              Zoek op kaartnaam, set of nummer
            </label>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Bijvoorbeeld: Charizard, Pikachu, 215, Obsidian Flames..."
                className="w-full rounded-2xl border border-neutral-300 px-5 py-4 outline-none focus:border-red-500"
              />
              <button
                type="button"
                className="rounded-2xl bg-red-600 px-6 py-4 font-semibold text-white"
              >
                Search
              </button>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 hover:border-red-500 hover:text-red-600 md:hidden"
            >
              {filtersOpen ? "Filters verbergen" : "Filters tonen"}
              {hasActiveFilters ? " • actief" : ""}
            </button>

            <div className={["mt-4 grid gap-3 md:grid md:grid-cols-4", filtersOpen ? "grid" : "hidden"].join(" ")}>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Set
                </span>
                <select
                  value={setCode}
                  onChange={(e) => setSetCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-red-500"
                >
                  <option value="all">Alle sets</option>
                  {setOptions.map((option) => (
                    <option key={option.setCode} value={option.setCode}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Rarity
                </span>
                <select
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-red-500"
                >
                  <option value="all">Alle rarities</option>
                  {rarityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Sortering
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-red-500"
                >
                  <option value="name-asc">Naam A-Z</option>
                  <option value="price-desc">Hoogste prijs</option>
                  <option value="price-asc">Laagste prijs</option>
                  <option value="set">Setvolgorde</option>
                  <option value="newest">Nieuwste update</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-bold text-neutral-700 hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">{searchLabel}</h2>
            </div>

            <div className="mt-4 grid gap-3">
              {items.map((item) => {
                const inCartQty =
                  cart.find((cartItem) => cartItem.cardKey === item.cardKey)?.qty ?? 0;

                return (
                  <article
                    key={item.cardKey}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                  >
                    <div className="grid grid-cols-[auto_1fr] gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                      <CardImage item={item} />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black leading-tight sm:text-lg sm:font-bold">
                            {item.name}
                          </h3>
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                            Buying
                          </span>
                          {inCartQty > 0 && (
                            <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold text-white">
                              {inCartQty} in list
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm leading-5 text-neutral-600 sm:leading-normal">
                          {item.setName ?? "Unknown set"}
                          {item.setCode ? ` • ${item.setCode}` : ""}
                          {item.collectorNumber ? ` • #${item.collectorNumber}` : ""}
                          {item.rarity ? ` • ${item.rarity}` : ""}
                        </p>

                        <p className="mt-2 text-xs text-neutral-500">
                          {item.language} • {item.condition} • {item.finishType} • CM{" "}
                          {item.cardmarketId}
                        </p>
                      </div>

                      <div className="col-span-2 mt-1 flex items-center gap-3 md:col-span-1 md:mt-0 md:justify-end">
                        <div className="flex min-w-[9rem] flex-1 items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-red-700 md:block md:min-w-28 md:flex-none md:text-right">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-red-500">
                            We pay
                          </p>
                          <p className="text-2xl font-black leading-none md:text-xl">
                            {euro(item.buyPrice)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="min-w-[7.25rem] rounded-2xl bg-red-600 px-5 py-4 text-base font-black text-white hover:bg-red-700 md:min-w-0 md:py-3 md:font-semibold"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {!loading && items.length === 0 && (
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-600">
                Geen kaarten gevonden. Probeer een andere zoekterm of gebruik bulk buy voor goedkope ex/V/VMAX/VSTAR kaarten.
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Your buylist</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {cartCount} card{cartCount === 1 ? "" : "s"} selected
                  </p>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-sm font-semibold text-neutral-500 hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-neutral-950 p-5 text-white">
                <p className="text-sm text-neutral-400">Estimated payout</p>
                <strong className="mt-1 block text-3xl">{euro(cartTotal)}</strong>
              </div>

              {cart.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">
                  Add cards to your list to see your estimated payout.
                </div>
              ) : (
                <div className="mt-5 max-h-[420px] space-y-3 overflow-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.cardKey}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <CardImage item={item} size="sm" />
                          <div className="min-w-0">
                            <strong className="block leading-snug">{item.name}</strong>
                            <span className="mt-1 block text-xs text-neutral-500">
                              {item.setCode ?? item.setName ?? "Unknown set"}
                              {item.collectorNumber
                                ? ` • #${item.collectorNumber}`
                                : ""}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.cardKey)}
                          className="text-sm font-bold text-neutral-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-full border border-neutral-300 bg-white">
                          <button
                            type="button"
                            onClick={() => changeQty(item.cardKey, -1)}
                            className="px-3 py-1 font-bold"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm font-bold">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQty(item.cardKey, 1)}
                            className="px-3 py-1 font-bold"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-neutral-500">
                            {item.qty} × {euro(item.buyPrice)}
                          </p>
                          <strong>{euro(lineTotal(item))}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/submit"
                aria-disabled={cart.length === 0}
                onClick={(e) => {
                  if (cart.length === 0) e.preventDefault();
                }}
                className={[
                  "mt-5 block w-full rounded-2xl px-5 py-4 text-center font-bold text-white",
                  cart.length === 0
                    ? "cursor-not-allowed bg-red-600 opacity-40"
                    : "bg-red-600 hover:bg-red-700",
                ].join(" ")}
              >
                Continue with buylist
              </Link>

              <p className="mt-4 text-xs leading-5 text-neutral-500">
                Final payout is confirmed after checking version, language,
                quantity and condition.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
