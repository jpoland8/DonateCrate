"use client";

import { useEffect, useState } from "react";

type Receipt = {
  id: string;
  pickup_date: string | null;
  status: string;
  zone_name: string | null;
  receipt_id: string | null;
  receipt_sent_at: string | null;
  has_receipt: boolean;
};

function safeDateLabel(value: string | null | undefined, fallback = "Date unavailable") {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString();
}

function safeDateTimeLabel(value: string | null | undefined, fallback = "Unknown") {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "dc-badge-success"
      : status === "picked_up"
        ? "dc-badge-warning"
        : "dc-badge-neutral";
  const label =
    status === "completed"
      ? "Completed"
      : status === "picked_up"
        ? "Picked up"
        : status.replaceAll("_", " ");
  return <span className={`dc-badge ${color}`}>{label}</span>;
}

export function ReceiptList() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/customer/receipts");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load receipts.");
        setReceipts(json.receipts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load receipts.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="dc-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="dc-skeleton h-5 w-40" />
                <div className="dc-skeleton h-4 w-56" />
              </div>
              <div className="dc-skeleton h-8 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="dc-toast dc-toast-error">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        {error}
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="dc-card p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--dc-gray-100)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-8 w-8 text-[var(--dc-gray-400)]"
            aria-hidden
          >
            <path
              d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v.01"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-5 text-base font-bold text-[var(--dc-gray-900)]">No pickups yet</p>
        <p className="mt-2 max-w-xs mx-auto text-sm text-[var(--dc-gray-500)]">
          Your receipt history will appear here after your first completed pickup.
        </p>
        <div className="mt-5">
          <a
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--dc-orange)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#e55f00] active:scale-[0.98]"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 dc-stagger">
      {receipts.map((receipt) => (
        <article key={receipt.id} className="dc-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--dc-gray-900)]">
                  {safeDateLabel(receipt.pickup_date, "Pickup date pending")}
                </h3>
                <StatusBadge status={receipt.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--dc-gray-500)]">
                {receipt.zone_name ? <span>Zone: {receipt.zone_name}</span> : null}
                {receipt.receipt_id ? (
                  <span className="font-mono text-[var(--dc-gray-400)]">{receipt.receipt_id}</span>
                ) : null}
                {receipt.receipt_sent_at ? (
                  <span>Receipt sent {safeDateTimeLabel(receipt.receipt_sent_at)}</span>
                ) : null}
              </div>
            </div>
            <div className="shrink-0">
              {receipt.has_receipt ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Receipt sent
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[var(--dc-gray-50)] px-3 py-1.5 text-xs font-semibold text-[var(--dc-gray-500)]">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                    <circle cx="8" cy="8" r="6" strokeWidth="1.5" />
                    <path d="M8 5v3l2 1" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Pending
                </span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
