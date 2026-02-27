"use client";

import { useState } from "react";

type ActionState = "idle" | "loading" | "error" | "success";

type CustomerActionsProps = {
  nextPickupDate: string | null;
  currentStatus: string | null;
};

export function CustomerActions({ nextPickupDate, currentStatus }: CustomerActionsProps) {
  const [state, setState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");

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
      setMessage("Updated successfully.");
      window.location.reload();
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
        <p className="text-xs uppercase tracking-wide text-[var(--dc-gray-700)]">Next Pickup Date</p>
        <p className="mt-1 text-lg font-bold">
          {nextPickupDate ? new Date(nextPickupDate).toLocaleDateString() : "Not scheduled"}
        </p>
        <p className="mt-1 text-xs text-[var(--dc-gray-700)]">Current cycle status: {currentStatus ?? "requested"}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => post("/api/pickup/request")}
          disabled={state === "loading"}
          className="rounded-xl border border-black px-4 py-2 text-sm font-semibold"
        >
          Confirm Pickup This Month
        </button>
        <button
          onClick={() => post("/api/pickup/skip")}
          disabled={state === "loading"}
          className="rounded-xl border border-black px-4 py-2 text-sm font-semibold"
        >
          Skip Driver Visit
        </button>
        {currentStatus === "skipped" ? (
          <button
            onClick={() => post("/api/pickup/unskip")}
            disabled={state === "loading"}
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
