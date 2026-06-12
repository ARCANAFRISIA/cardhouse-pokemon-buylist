"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CartItem = {
  cardKey: string;
  name: string;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  buyPrice: number | null;
  qty: number;
};

type SubmitResult = {
  ok: boolean;
  submissionId?: string;
  itemCount?: number;
  totalCents?: number;
  error?: string;
};

function euro(value: number | null) {
  if (value == null) return "—";

  return `€ ${value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function euroCents(cents: number | undefined) {
  if (cents == null) return "—";
  return euro(cents / 100);
}

const FREE_LABEL_THRESHOLD_CENTS = 40_000;

export default function SubmitPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Netherlands");

  const [payoutMethod, setPayoutMethod] = useState("BANK");
  const [iban, setIban] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
const [confirmEnglishNm, setConfirmEnglishNm] = useState(false);
const [confirmSorted, setConfirmSorted] = useState(false);
const [confirmNoteIncluded, setConfirmNoteIncluded] = useState(false);
const [confirmDetailsCorrect, setConfirmDetailsCorrect] = useState(false);

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
      setLoaded(true);
    }
  }, []);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + (item.buyPrice ?? 0) * item.qty, 0),
    [cart]
  );

  const cardCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

const allChecksAccepted =
  acceptTerms &&
  confirmEnglishNm &&
  confirmSorted &&
  confirmNoteIncluded &&
  confirmDetailsCorrect;

  async function submit() {
    if (cart.length === 0 || busy) return;

    setBusy(true);
    setResult(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
  fullName,
  email,
  phone,
  addressLine1,
  postalCode,
  city,
  country,
  payoutMethod,
  iban,
  paypalEmail,
  customerMessage,
  acceptTerms,
  confirmEnglishNm,
  confirmSorted,
  confirmNoteIncluded,
  confirmDetailsCorrect,
},
          items: cart.map((item) => ({
            cardKey: item.cardKey,
            qty: item.qty,
          })),
        }),
      });

      const json = (await res.json()) as SubmitResult;
      setResult(json);

      if (json.ok) {
        window.localStorage.removeItem("cardhouse-buylist-cart");
        setCart([]);
      }
    } catch (error: any) {
      setResult({
        ok: false,
        error: error?.message ?? "Submission failed",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8 text-neutral-950">
        Loading...
      </main>
    );
  }

  if (result?.ok) {
    const freeLabelEligible = (result.totalCents ?? 0) >= FREE_LABEL_THRESHOLD_CENTS;
    return (
      <main className="min-h-screen bg-neutral-50 text-neutral-950">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
              Submission received
            </p>

            <h1 className="mt-4 text-4xl font-black">Bedankt!</h1>

<p className="mt-4 text-neutral-600">
  Je buylist is ontvangen door Card House of the East. Sorteer de kaarten op
  dezelfde volgorde als je buylist en voeg een briefje toe met je naam,
  e-mailadres en referentie.
</p>

            <div className="mt-6 rounded-2xl bg-neutral-50 p-5 text-sm">
              <div className="flex justify-between">
                <span>Reference</span>
                <strong>{result.submissionId?.slice(0, 8)}</strong>
              </div>
              <div className="mt-3 flex justify-between">
                <span>Cards</span>
                <strong>{result.itemCount}</strong>
              </div>
              <div className="mt-3 flex justify-between">
                <span>Estimated payout</span>
                <strong>{euroCents(result.totalCents)}</strong>
              </div>
            </div>

<div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-left text-sm leading-6 text-neutral-800">
  <div className="flex items-start gap-3">
    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-red-600" />
    <div>
      <strong className="text-neutral-950">Verzendinstructies</strong>

      {freeLabelEligible ? (
        <p className="mt-2">
          Je buylist is €400 of hoger. Card House of the East kan hiervoor
          kosteloos een verzendlabel aanbieden. Je ontvangt hierover verdere
          instructies per e-mail.
        </p>
      ) : (
        <p className="mt-2">
          Je buylist is lager dan €400. Je verzendt de kaarten zelf, op eigen
          kosten en risico. Gebruik bij voorkeur verzending met track & trace.
        </p>
      )}

      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>Leg je kaarten op dezelfde volgorde als deze buylist.</li>
        <li>
          Voeg een briefje toe met je naam, e-mailadres en referentie:{" "}
          <strong>{result.submissionId?.slice(0, 8)}</strong>
        </li>
        <li>Gebruik sleeves en stevige bescherming, zodat kaarten niet kunnen schuiven of buigen.</li>
        <li>Gebruik zo min mogelijk tape direct rondom kaarten of sleeves.</li>
        <li>
          Bekijk ook de{" "}
          <Link href="/packing-guide" className="font-semibold text-red-600 underline">
            verpakkingsguide
          </Link>
          .
        </li>
      </ul>
    </div>
  </div>
</div>

            <Link
              href="/"
              className="mt-8 inline-flex rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
            >
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
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
            href="/buy"
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white hover:text-neutral-950"
          >
            Back to buylist
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_380px]">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
            Submit buylist
          </p>

          <h1 className="mt-3 text-4xl font-black">Je gegevens</h1>

          <p className="mt-3 text-neutral-600">
            Vul je gegevens in. De uiteindelijke uitbetaling wordt bevestigd na
            controle van versie, taal, aantal en conditie.
          </p>

          <div className="mt-8 grid gap-4">
            <div>
              <label className="text-sm font-semibold">Naam *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Telefoon</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_160px]">
              <div>
                <label className="text-sm font-semibold">Adres</label>
                <input
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Postcode</label>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold">Plaats</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Land</label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Uitbetaling</label>
              <select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="BANK">Bank transfer</option>
                <option value="PAYPAL">PayPal</option>
              </select>
            </div>

            {payoutMethod === "BANK" ? (
              <div>
                <label className="text-sm font-semibold">IBAN</label>
                <input
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-semibold">PayPal e-mail</label>
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-semibold">Opmerking</label>
              <textarea
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-neutral-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </div>

 <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
  <h2 className="text-lg font-black">Voordat je indient</h2>

<p className="mt-2 text-sm leading-6 text-neutral-600">
  Controleer je gegevens en bereid je kaarten goed voor. Buylists onder €400
  verzend je zelf. Vanaf €400 kan Card House of the East kosteloos een
  verzendlabel aanbieden.
</p>

  <div className="mt-4 space-y-3 text-sm">
    <label className="flex gap-3 rounded-xl bg-white p-3">
      <input
        type="checkbox"
        checked={acceptTerms}
        onChange={(e) => setAcceptTerms(e.target.checked)}
        className="mt-1"
      />
      <span>
        Ik ga akkoord met de{" "}
<Link href="/terms" className="font-semibold text-red-600 underline">
  buylistvoorwaarden
</Link>{" "}
en begrijp dat de definitieve uitbetaling wordt vastgesteld na controle.
      </span>
    </label>

    <label className="flex gap-3 rounded-xl bg-white p-3">
      <input
        type="checkbox"
        checked={confirmEnglishNm}
        onChange={(e) => setConfirmEnglishNm(e.target.checked)}
        className="mt-1"
      />
      <span>
  Ik bevestig dat de ingestuurde kaarten Engels of Japans zijn en Near Mint zijn.
  Als een kaart niet Near Mint is, mag Card House of the East de uitbetaling
  aanpassen of de kaart weigeren.
</span>
    </label>

    <label className="flex gap-3 rounded-xl bg-white p-3">
      <input
        type="checkbox"
        checked={confirmSorted}
        onChange={(e) => setConfirmSorted(e.target.checked)}
        className="mt-1"
      />
      <span>
        Ik leg de kaarten op dezelfde volgorde als deze buylist.
      </span>
    </label>

    <label className="flex gap-3 rounded-xl bg-white p-3">
      <input
        type="checkbox"
        checked={confirmNoteIncluded}
        onChange={(e) => setConfirmNoteIncluded(e.target.checked)}
        className="mt-1"
      />
    <span>
  Ik voeg een briefje toe met mijn naam, e-mailadres en buylistreferentie in het pakket.
</span>
    </label>
    <label className="flex gap-3 rounded-xl bg-white p-3">
  <input
    type="checkbox"
    checked={confirmDetailsCorrect}
    onChange={(e) => setConfirmDetailsCorrect(e.target.checked)}
    className="mt-1"
  />
  <span>
    Ik heb mijn contact-, adres- en uitbetalingsgegevens gecontroleerd en begrijp
    dat Card House of the East niet verantwoordelijk is voor vertraging of
    foutieve uitbetaling door verkeerd ingevulde gegevens.
  </span>
</label>
  </div>
</div>

            {result && !result.ok && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {result.error ?? "Submission failed"}
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={busy || cart.length === 0 || !fullName || !email || !allChecksAccepted}
              className="rounded-2xl bg-red-600 px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Indienen..." : "Buylist indienen"}
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Summary</h2>

            <div className="mt-5 rounded-2xl bg-neutral-950 p-5 text-white">
              <p className="text-sm text-neutral-400">Estimated payout</p>
              <strong className="mt-1 block text-3xl">{euro(total)}</strong>
            </div>

            <p className="mt-4 text-sm text-neutral-500">
              {cardCount} card{cardCount === 1 ? "" : "s"} selected
            </p>

            {cart.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">
                Your buylist is empty.
              </div>
            ) : (
              <div className="mt-5 max-h-[480px] space-y-3 overflow-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.cardKey}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                  >
                    <strong className="block leading-snug">{item.name}</strong>
                    <span className="mt-1 block text-xs text-neutral-500">
                      {item.setCode ?? item.setName ?? "Unknown set"}
                      {item.collectorNumber ? ` • #${item.collectorNumber}` : ""}
                    </span>

                    <div className="mt-3 flex justify-between text-sm">
                      <span>
                        {item.qty} × {euro(item.buyPrice)}
                      </span>
                      <strong>{euro((item.buyPrice ?? 0) * item.qty)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-neutral-500">
              Prices are recalculated server-side when you submit.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}