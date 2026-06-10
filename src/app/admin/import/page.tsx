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
      <section className="mx-auto max-w-4xl px-6 py-10">
        <a href="/admin" className="text-sm text-neutral-400 hover:text-white">
          ← Back to dashboard
        </a>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            PowerTools
          </p>
          <h1 className="mt-3 text-4xl font-bold">Import prices</h1>
          <p className="mt-2 text-neutral-400">
            Upload a PowerTools CSV export. This fills the Pokémon catalog and
            current buylist prices.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <label className="block text-sm font-medium text-neutral-300">
            PowerTools CSV file
          </label>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-3 block w-full rounded-xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-200"
          />

          <button
            type="button"
            onClick={submitImport}
            disabled={!file || busy}
            className="mt-5 rounded-full bg-red-600 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Importing..." : "Import PowerTools prices"}
          </button>

          {result && (
            <div
              className={[
                "mt-6 rounded-xl border p-4 text-sm",
                result.ok
                  ? "border-green-500/30 bg-green-500/10 text-green-100"
                  : "border-red-500/30 bg-red-500/10 text-red-100",
              ].join(" ")}
            >
              {result.ok ? (
                <div>
                  <strong>Import complete</strong>
                  <div className="mt-2 space-y-1">
                    <p>Rows: {result.rows ?? 0}</p>
                    <p>Imported: {result.imported ?? 0}</p>
                    <p>Skipped: {result.skipped ?? 0}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <strong>Import failed</strong>
                  <p className="mt-2">{result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}