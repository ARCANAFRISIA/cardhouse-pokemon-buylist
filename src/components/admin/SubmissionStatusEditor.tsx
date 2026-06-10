"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "RECEIVED", label: "Received" },
  { value: "CHECKING", label: "Checking" },
  { value: "ADJUSTED", label: "Adjusted" },
  { value: "APPROVED", label: "Approved" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
];

type Props = {
  submissionId: string;
  currentStatus: string;
};

export default function SubmissionStatusEditor({
  submissionId,
  currentStatus,
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState(currentStatus);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveStatus() {
    setBusy(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          message,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Status update failed");
      }

      setResult("Status updated");
      setMessage("");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Status update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-xl font-bold">Status</h2>

      <div className="mt-4">
        <label className="text-sm font-semibold text-neutral-300">
          Current status
        </label>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none"
        >
          {STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-neutral-300">
          Message / note
        </label>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Optional note. Later this can be included in customer emails."
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
        onClick={saveStatus}
        disabled={busy || status === currentStatus}
        className="mt-5 w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Saving..." : "Update status"}
      </button>
    </div>
  );
}