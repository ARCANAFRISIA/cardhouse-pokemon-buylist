"use client";

import { useState } from "react";

type ImportResult = {
  ok: boolean;
  rows?: number;
  imported?: number;
  skipped?: number;
  error?: string;
};

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function submitImport() {
    if (!file) return;

    setBusy(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch("/api/admin/import/powertools", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as ImportResult;
      setResult(json);
    } catch (error: any) {
      setResult({
        ok: false,
        error: error?.message ?? "Import failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <a href="/admin" className="text-sm text-neutral-400 hover:text-white">
          ← Back to dashboard
        </a>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            PowerTools
          </p>
          <h1 className="mt-3 text-4xl font-bold">Prijzen uploaden</h1>
          <p className="mt-2 max-w-2xl text-neutral-400">
            Upload hier de CSV die uit PowerTools komt nadat de kaarten zijn
            geprijsd. De buylist wordt daarna direct bijgewerkt.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-bold">Upload PowerTools CSV</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Kies het exportbestand uit PowerTools. Gebruik alleen een bestand
              waarin PowerTools echte prijzen heeft gezet. Upload geen template
              met 1000 / 500 voorbeeldprijzen.
            </p>

            <label className="mt-6 block text-sm font-medium text-neutral-300">
              CSV bestand
            </label>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-3 block w-full rounded-xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-200"
            />

            {file && (
              <div className="mt-3 rounded-xl bg-neutral-900 p-3 text-sm text-neutral-300">
                Geselecteerd: <strong className="text-white">{file.name}</strong>
              </div>
            )}

            <button
              type="button"
              onClick={submitImport}
              disabled={!file || busy}
              className="mt-5 rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Bezig met uploaden..." : "Upload prijzen"}
            </button>

            {result && (
              <div
                className={[
                  "mt-6 rounded-xl border p-5 text-sm",
                  result.ok
                    ? "border-green-500/30 bg-green-500/10 text-green-100"
                    : "border-red-500/30 bg-red-500/10 text-red-100",
                ].join(" ")}
              >
                {result.ok ? (
                  <div>
                    <strong className="text-lg">Buylist bijgewerkt</strong>
                    <p className="mt-2 text-green-100/90">
                      De nieuwe PowerTools-prijzen staan nu live op de buylist.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-green-950/30 p-3">
                        <p className="text-xs text-green-100/70">Regels gelezen</p>
                        <strong className="mt-1 block text-2xl">{result.rows ?? 0}</strong>
                      </div>
                      <div className="rounded-xl bg-green-950/30 p-3">
                        <p className="text-xs text-green-100/70">Kaarten bijgewerkt</p>
                        <strong className="mt-1 block text-2xl">
                          {result.imported ?? 0}
                        </strong>
                      </div>
                      <div className="rounded-xl bg-green-950/30 p-3">
                        <p className="text-xs text-green-100/70">Overgeslagen</p>
                        <strong className="mt-1 block text-2xl">{result.skipped ?? 0}</strong>
                      </div>
                    </div>
                    {(result.skipped ?? 0) > 0 && (
                      <p className="mt-4 text-sm text-green-100/80">
                        Er zijn regels overgeslagen. Controleer of taal, conditie
                        en kolommen kloppen.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <strong className="text-lg">Upload mislukt</strong>
                    <p className="mt-2 whitespace-pre-wrap">
                      {result.error ?? "Onbekende fout"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">Zo werkt het</h2>
              <ol className="mt-4 space-y-4 text-sm leading-6 text-neutral-300">
                <li>
                  <strong className="text-white">1. Download een CSV</strong>
                  <p className="text-neutral-400">
                    Ga naar Catalogus & prijzen en download de PowerTools CSV.
                  </p>
                </li>
                <li>
                  <strong className="text-white">2. Prijs in PowerTools</strong>
                  <p className="text-neutral-400">
                    Laat PowerTools autopricen of pas prijzen handmatig aan.
                  </p>
                </li>
                <li>
                  <strong className="text-white">3. Exporteer uit PowerTools</strong>
                  <p className="text-neutral-400">
                    Sla het geprijsde CSV-bestand op je computer op.
                  </p>
                </li>
                <li>
                  <strong className="text-white">4. Upload hier</strong>
                  <p className="text-neutral-400">
                    Na upload staan de nieuwe prijzen direct live.
                  </p>
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-6 text-sm text-yellow-100">
              <h2 className="text-lg font-bold">Let op</h2>
              <p className="mt-2 leading-6">
                Upload geen bestand waarin nog overal 1000 of 500 staat. Dat zijn
                alleen voorbeeldprijzen voor PowerTools.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
