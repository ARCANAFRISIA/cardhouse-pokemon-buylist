"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BulkCategory = {
  id: string;
  label: string;
  description: string;
  unitCents: number;
  unitPrice: number;
  minQty: number;
  maxQty: number | null;
  sortOrder: number;
};

type CartItem = {
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

function makeBulkCartItem(category: BulkCategory, qty: number): CartItem {
  return {
    id: category.id,
    cardKey: category.id,
    cardmarketId: 0,
    name: category.label,
    setName: "Bulk",
    setCode: "BULK",
    collectorNumber: null,
    rarity: "Bulk",
    series: "Bulk",
    language: "Mixed",
    condition: "NM",
    finishType: "Bulk",
    imageUrl: null,
    marketPrice: category.unitPrice,
    buyPrice: category.unitPrice,
    priceSource: "BULK_SETTING",
    qty,
  };
}

export default function BulkPage() {
  const [categories, setCategories] = useState<BulkCategory[]>([]);
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + lineTotal(item), 0);

  useEffect(() => {
    async function loadCategories() {
      const res = await fetch("/api/bulk", { cache: "no-store" });
      const json = await res.json();
      setCategories(json.categories ?? []);

      const initialQty: Record<string, number> = {};
      for (const category of json.categories ?? []) {
        initialQty[category.id] = category.minQty ?? 1;
      }
      setQtyById(initialQty);
    }

    loadCategories()
      .catch((error) => {
        console.error("Bulk categories failed", error);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("cardhouse-buylist-cart");
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setCart(parsed);
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

  const bulkInCart = useMemo(
    () => new Map(cart.filter((item) => item.cardKey.startsWith("BULK_")).map((item) => [item.cardKey, item.qty])),
    [cart]
  );

  function updateQty(category: BulkCategory, value: number) {
    const min = category.minQty ?? 1;
    const max = category.maxQty ?? 100000;
    const next = Math.max(min, Math.min(max, Math.round(value || min)));
    setQtyById((current) => ({ ...current, [category.id]: next }));
  }

  function addBulk(category: BulkCategory) {
    const qty = qtyById[category.id] ?? category.minQty ?? 1;
    const item = makeBulkCartItem(category, qty);

    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.cardKey === category.id);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.cardKey === category.id ? { ...cartItem, qty: cartItem.qty + qty } : cartItem
        );
      }
      return [...current, item];
    });

    setMessage(`${category.label} toegevoegd aan je buylist.`);
    window.setTimeout(() => setMessage(null), 2500);
  }

  function changeQty(cardKey: string, delta: number) {
    setCart((current) =>
      current
        .map((item) => (item.cardKey === cardKey ? { ...item, qty: item.qty + delta } : item))
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-neutral-950">CH</div>
            <div>
              <p className="text-xs text-neutral-400 sm:text-sm">Pokémon Buylist</p>
              <strong className="text-sm sm:text-base">Card House of the East</strong>
            </div>
          </Link>

          <Link href="/buy" className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950">
            Losse kaarten
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-600 sm:text-sm">Bulk buy</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Verkoop bulk Pokémon hits</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
            Voor goedkope ex, V, VMAX, VSTAR en vergelijkbare hits die niet los in de buylist staan. De definitieve beoordeling gebeurt na controle door Card House of the East.
          </p>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            {loading ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-neutral-600">Loading bulk categories...</div>
            ) : categories.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-neutral-600">
                Bulk buy is momenteel niet actief.
              </div>
            ) : (
              <div className="grid gap-4">
                {categories.map((category) => {
                  const qty = qtyById[category.id] ?? category.minQty;
                  const inCart = bulkInCart.get(category.id) ?? 0;

                  return (
                    <article key={category.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-black">{category.label}</h2>
                            {inCart > 0 && <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-bold text-white">{inCart} in list</span>}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-neutral-600">{category.description}</p>
                          <p className="mt-3 text-sm text-neutral-500">
                            Minimum: <strong>{category.minQty}</strong>
                            {category.maxQty ? <> • Maximum: <strong>{category.maxQty}</strong></> : null}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-right text-red-950">
                          <p className="text-xs font-semibold text-red-700">We pay</p>
                          <p className="text-2xl font-black">{euro(category.unitPrice)}</p>
                          <p className="text-xs text-red-700">per stuk</p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="block">
                          <span className="text-sm font-semibold text-neutral-700">Aantal</span>
                          <input
                            type="number"
                            min={category.minQty}
                            max={category.maxQty ?? undefined}
                            value={qty}
                            onChange={(event) => updateQty(category, Number(event.target.value))}
                            className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500 sm:w-40"
                          />
                        </label>

                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <div className="text-right">
                            <p className="text-xs text-neutral-500">Estimated</p>
                            <strong>{euro(category.unitPrice * qty)}</strong>
                          </div>
                          <button type="button" onClick={() => addBulk(category)} className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700">
                            Add bulk
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Your buylist</h2>
                  <p className="mt-1 text-sm text-neutral-500">{cartCount} card{cartCount === 1 ? "" : "s"} selected</p>
                </div>
                {cart.length > 0 && <button type="button" onClick={clearCart} className="text-sm font-semibold text-neutral-500 hover:text-red-600">Clear</button>}
              </div>

              <div className="mt-5 rounded-2xl bg-neutral-950 p-5 text-white">
                <p className="text-sm text-neutral-400">Estimated payout</p>
                <strong className="mt-1 block text-3xl">{euro(cartTotal)}</strong>
              </div>

              {cart.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">Add bulk categories or loose cards to your list.</div>
              ) : (
                <div className="mt-5 max-h-[420px] space-y-3 overflow-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.cardKey} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <strong className="block leading-snug">{item.name}</strong>
                          <span className="mt-1 block text-xs text-neutral-500">{item.setCode ?? item.setName ?? "Unknown set"}{item.collectorNumber ? ` • #${item.collectorNumber}` : ""}</span>
                        </div>
                        <button type="button" onClick={() => removeFromCart(item.cardKey)} className="text-sm font-bold text-neutral-400 hover:text-red-600">×</button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-full border border-neutral-300 bg-white">
                          <button type="button" onClick={() => changeQty(item.cardKey, -1)} className="px-3 py-1 font-bold">−</button>
                          <span className="min-w-8 text-center text-sm font-bold">{item.qty}</span>
                          <button type="button" onClick={() => changeQty(item.cardKey, 1)} className="px-3 py-1 font-bold">+</button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-neutral-500">{item.qty} × {euro(item.buyPrice)}</p>
                          <strong>{euro(lineTotal(item))}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Link href="/submit" aria-disabled={cart.length === 0} onClick={(e) => { if (cart.length === 0) e.preventDefault(); }} className={["mt-5 block w-full rounded-2xl px-5 py-4 text-center font-bold text-white", cart.length === 0 ? "cursor-not-allowed bg-red-600 opacity-40" : "bg-red-600 hover:bg-red-700"].join(" ")}>Continue with buylist</Link>

              <Link href="/buy" className="mt-3 block w-full rounded-2xl border border-neutral-300 px-5 py-3 text-center text-sm font-bold text-neutral-700 hover:bg-neutral-50">
                Add loose cards
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
