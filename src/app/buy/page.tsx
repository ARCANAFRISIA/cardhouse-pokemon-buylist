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

export default function BuyPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + lineTotal(item), 0);

  const searchLabel = useMemo(() => {
    if (loading) return "Searching...";
    if (items.length === 0) return "No buylist cards found";
    return `${items.length} buylist card${items.length === 1 ? "" : "s"} found`;
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
        if (q.trim().length >= 2) {
          params.set("q", q.trim());
        }

    params.set("t", Date.now().toString());

const res = await fetch(`/api/cards/search?${params.toString()}`, {
  signal: controller.signal,
  cache: "no-store",
});

        const json = await res.json();
        setItems(json.items ?? []);
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
  }, [q]);

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
            href="/"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white hover:text-neutral-950"
          >
            Home
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
                Pokémon Buylist
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Zoek je Pokémon kaarten
              </h1>
              <p className="mt-4 max-w-2xl text-neutral-600">
                Wij kopen momenteel Engelse Near Mint hits. De getoonde prijs is
                een indicatie en wordt definitief na controle.
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

          <div className="mt-8">
            <label className="text-sm font-semibold text-neutral-700">
              Search by card name, set or number
            </label>
            <div className="mt-2 flex gap-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Example: Charizard, Pikachu, 215, Obsidian Flames..."
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
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{searchLabel}</h2>
              <p className="text-sm text-neutral-500">
                Prices from current PowerTools import
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {items.map((item) => {
                const inCartQty =
                  cart.find((cartItem) => cartItem.cardKey === item.cardKey)?.qty ?? 0;

                return (
                  <article
                    key={item.cardKey}
                    className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold">{item.name}</h3>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                          Buying
                        </span>
                        {inCartQty > 0 && (
                          <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold text-white">
                            {inCartQty} in list
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-neutral-600">
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

                    <div className="flex items-center gap-4 md:justify-end">
                      <div className="min-w-28 rounded-2xl bg-neutral-950 px-5 py-3 text-right text-white">
                        <p className="text-xs text-neutral-400">We pay</p>
                        <p className="text-xl font-black">{euro(item.buyPrice)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
                      >
                        Add
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {!loading && items.length === 0 && (
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-600">
                No cards found yet. Import more PowerTools data or search another
                card.
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
                <strong className="mt-1 block text-3xl">
                  {euro(cartTotal)}
                </strong>
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
                        <div>
                          <strong className="block leading-snug">{item.name}</strong>
                          <span className="mt-1 block text-xs text-neutral-500">
                            {item.setCode ?? item.setName ?? "Unknown set"}
                            {item.collectorNumber
                              ? ` • #${item.collectorNumber}`
                              : ""}
                          </span>
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