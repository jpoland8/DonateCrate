"use client";

import { useState } from "react";

type ActionState = "idle" | "loading" | "error" | "success";

type CustomerActionsProps = {
  nextPickupDate: string | null;
  currentStatus: string | null;
  requestCutoffAt?: string | null;
  lastUpdatedAt?: string | null;
  profileComplete?: boolean;
};

function formatStatus(status: string | null) {
  switch (status) {
    case "requested":
      return "Pickup requested";
    case "skipped":
      return "Skipped this month";
    case "completed":
      return "Pickup completed";
    case "canceled":
      return "Pickup canceled";
    default:
      return "Ready for response";
  }
}

export function CustomerActions({
  nextPickupDate,
  currentStatus,
  requestCutoffAt = null,
  lastUpdatedAt = null,
  profileComplete = true,
}: CustomerActionsProps) {
  const [state, setState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");
  const [localStatus, setLocalStatus] = useState(currentStatus);
  const [localUpdatedAt, setLocalUpdatedAt] = useState(lastUpdatedAt);
  const cutoffPassed = requestCutoffAt ? new Date() > new Date(requestCutoffAt) : false;

  async function fetchWithTimeout(path: string, init?: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      return await fetch(path, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function post(path: string) {
    setState("loading");
    setMessage("");
    try {
      const response = await fetchWithTimeout(path, { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState("error");
        setMessage(json.error || "Request failed");
        return;
      }
      setState("success");
      setLocalStatus(json.pickupRequest?.status ?? localStatus);
      setLocalUpdatedAt(json.pickupRequest?.updated_at ?? new Date().toISOString());
      if (path.endsWith("/request")) {
        setMessage("Your household is marked ready for this month.");
      } else if (path.endsWith("/skip")) {
        setMessage("This month is marked skipped. Billing stays unchanged.");
      } else {
        setMessage("Your skip was removed. This month is back on your route-ready list.");
      }
    } catch {
      setState("error");
      setMessage("Unable to save right now. Please try again.");
    }
  }

  async function startCheckout() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetchWithTimeout("/api/billing/checkout-session", { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setState("error");
        setMessage(json.error || "Checkout failed");
        return;
      }
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setState("error");
      setMessage("Checkout URL was not returned.");
    } catch {
      setState("error");
      setMessage("Unable to reach billing right now. Please try again.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-black/10 bg-[var(--dc-gray-100)] p-3">
        <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Current Cycle</p>
        <p className="mt-1 text-lg font-bold">
          {nextPickupDate ? new Date(nextPickupDate).toLocaleDateString() : "Not scheduled"}
        </p>
        <p className="mt-1 text-xs text-[var(--dc-gray-700)]">Status: {formatStatus(localStatus)}</p>
        {requestCutoffAt ? (
          <p className="mt-1 text-xs text-[var(--dc-gray-700)]">
            Response deadline: {new Date(requestCutoffAt).toLocaleString()}
          </p>
        ) : null}
        {localUpdatedAt ? (
          <p className="mt-1 text-xs text-[var(--dc-gray-700)]">
            Last updated: {new Date(localUpdatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>
      {!profileComplete ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Add your phone number and full pickup address in Profile before route planning begins.
        </div>
      ) : null}
      {cutoffPassed ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          The response cutoff for this cycle has passed. Contact support if you need a manual change.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => post("/api/pickup/request")}
          disabled={state === "loading" || cutoffPassed}
          className="rounded-xl border border-black px-4 py-2 text-sm font-semibold"
        >
          {localStatus === "requested" ? "Keep Pickup Requested" : "Confirm Pickup This Month"}
        </button>
        <button
          onClick={() => post("/api/pickup/skip")}
          disabled={state === "loading"}
          className="rounded-xl border border-black px-4 py-2 text-sm font-semibold"
        >
          {localStatus === "skipped" ? "Keep Month Skipped" : "Skip Driver Visit"}
        </button>
        {localStatus === "skipped" ? (
          <button
            onClick={() => post("/api/pickup/unskip")}
            disabled={state === "loading" || cutoffPassed}
            className="rounded-xl border border-black px-4 py-2 text-sm font-semibold"
          >
            Undo Skip
          </button>
        ) : null}
        <button
          onClick={startCheckout}
          disabled={state === "loading"}
          className="rounded-xl border border-black px-4 py-2 text-sm font-semibold"
        >
          Manage Billing
        </button>
      </div>
      {message ? (
        <p className={`text-sm ${state === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>
      ) : null}
      <p className="text-xs text-[var(--dc-gray-700)]">
        Skipping a month only removes your stop from this cycle and does not change your subscription billing.
      </p>
    </div>
  );
}
