"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ItemInput = {
  id: string;
  cardName: string | null;
  setName: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  qty: number;
  unitCents: number;
  lineCents: number;
  itemStatus: string;
  receivedCondition: string | null;
  adminNote: string | null;
};

type EditableItem = ItemInput & {
  unitEuro: string;
};

type Props = {
  submissionId: string;
  items: ItemInput[];
  excellentPenaltyPct: number;
};

function centsToEuro(cents: number) {
  return (cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseEuroToCents(value: string) {
  const clean = value
    .trim()
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(clean);

  if (!Number.isFinite(n) || n < 0) return 0;

  return Math.round(n * 100);
}

function applyPenalty(unitCents: number, penaltyPct: number) {
  return Math.floor((unitCents * (100 - penaltyPct)) / 100);
}

export default function SubmissionItemsEditor({
  submissionId,
  items,
  excellentPenaltyPct,
}: Props) {
  const router = useRouter();

  const [rows, setRows] = useState<EditableItem[]>(
    items.map((item) => ({
      ...item,
      itemStatus: item.itemStatus ?? "PENDING",
      receivedCondition: item.receivedCondition ?? null,
      adminNote: item.adminNote ?? "",
      unitEuro: centsToEuro(item.unitCents),
    }))
  );

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalCents = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (row.itemStatus === "REJECTED") return sum;
        return sum + row.qty * parseEuroToCents(row.unitEuro);
      }, 0),
    [rows]
  );

  function updateRow(id: string, patch: Partial<EditableItem>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function applyExPenalty(id: string) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;

        const currentUnit = parseEuroToCents(row.unitEuro);
        const adjusted = applyPenalty(currentUnit, excellentPenaltyPct);

        return {
          ...row,
          receivedCondition: "EX",
          itemStatus: "ADJUSTED",
          unitEuro: centsToEuro(adjusted),
          adminNote:
            row.adminNote ||
            `Excellent conditie toegepast: -${excellentPenaltyPct}%`,
        };
      })
    );
  }

  function rejectRow(id: string) {
    updateRow(id, {
      itemStatus: "REJECTED",
      receivedCondition: "OTHER",
      qty: 0,
      unitEuro: "0,00",
      adminNote: "Afgekeurd",
    });
  }

  async function save() {
    setBusy(true);
    setResult(null);
    setError(null);

    try {
      const payload = {
        message,
        items: rows.map((row) => ({
          id: row.id,
          qty: row.itemStatus === "REJECTED" ? 0 : row.qty,
          unitCents:
            row.itemStatus === "REJECTED" ? 0 : parseEuroToCents(row.unitEuro),
          itemStatus: row.itemStatus,
          receivedCondition: row.receivedCondition,
          adminNote: row.adminNote ?? "",
        })),
      };

      const res = await fetch(`/api/admin/submissions/${submissionId}/items`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Opslaan mislukt");
      }

      setResult("Items opgeslagen");
      setMessage("");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Items aanpassen</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Pas aantallen, ontvangen conditie of uitbetaling aan. Opslaan zet de
            submission op ADJUSTED.
          </p>
        </div>

        <div className="rounded-xl bg-neutral-900 px-4 py-3 text-right">
          <p className="text-xs text-neutral-400">Nieuw totaal</p>
          <strong>€ {centsToEuro(totalCents)}</strong>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((row) => {
          const unitCents = parseEuroToCents(row.unitEuro);
          const lineCents =
            row.itemStatus === "REJECTED" ? 0 : unitCents * row.qty;

          return (
            <div
              key={row.id}
              className="rounded-2xl border border-white/10 bg-neutral-900 p-4"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h3 className="font-bold">{row.cardName}</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    {row.setName ?? "—"}
                    {row.setCode ? ` · ${row.setCode}` : ""}
                    {row.collectorNumber ? ` · #${row.collectorNumber}` : ""}
                    {row.rarity ? ` · ${row.rarity}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-neutral-400">Line</p>
                  <strong>€ {centsToEuro(lineCents)}</strong>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[90px_120px_150px_150px_1fr]">
                <label className="block">
                  <span className="text-xs text-neutral-400">Qty</span>
                  <input
                    type="number"
                    min={0}
                    value={row.qty}
                    onChange={(e) =>
                      updateRow(row.id, { qty: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-neutral-400">Unit €</span>
                  <input
                    value={row.unitEuro}
                    onChange={(e) =>
                      updateRow(row.id, { unitEuro: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white"
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-neutral-400">Received</span>
                  <select
                    value={row.receivedCondition ?? ""}
                    onChange={(e) =>
                      updateRow(row.id, {
                        receivedCondition: e.target.value || null,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="">—</option>
                    <option value="NM">NM</option>
                    <option value="EX">EX</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-neutral-400">Status</span>
                  <select
                    value={row.itemStatus}
                    onChange={(e) =>
                      updateRow(row.id, { itemStatus: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="ADJUSTED">Adjusted</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs text-neutral-400">Note</span>
                  <input
                    value={row.adminNote ?? ""}
                    onChange={(e) =>
                      updateRow(row.id, { adminNote: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyExPenalty(row.id)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-neutral-200 hover:bg-white hover:text-neutral-950"
                >
                  Apply EX -{excellentPenaltyPct}%
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateRow(row.id, {
                      receivedCondition: "NM",
                      itemStatus: "ACCEPTED",
                      adminNote: row.adminNote || "Geaccepteerd als NM",
                    })
                  }
                  className="rounded-full border border-green-500/30 px-3 py-1.5 text-xs font-bold text-green-200 hover:bg-green-500/10"
                >
                  Accept NM
                </button>

                <button
                  type="button"
                  onClick={() => rejectRow(row.id)}
                  className="rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/10"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <label className="text-sm font-semibold text-neutral-300">
          Algemene wijzigingsnotitie
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Bijvoorbeeld: Enkele kaarten waren Excellent in plaats van Near Mint."
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none"
        />
      </div>

      {result && (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-100">
          {result}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Opslaan..." : "Items opslaan"}
      </button>
    </div>
  );
}