"use client";

import { useState } from "react";
import { formatCycleStatus, getCycleUrgency } from "@/lib/customer-cycle";
import { trackMeta } from "@/lib/meta-pixel";

type ActionState = "idle" | "loading" | "error" | "success";

type CustomerActionsProps = {
  nextPickupDate: string | null;
  currentStatus: string | null;
  requestCutoffAt?: string | null;
  lastUpdatedAt?: string | null;
  profileComplete?: boolean;
};

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
  const urgency = getCycleUrgency(nextPickupDate, requestCutoffAt, new Date());
  const currentLabel = formatCycleStatus(localStatus);
  const actionSummary =
    localStatus === "requested" || localStatus === "confirmed"
      ? "Your home is included for this cycle."
      : localStatus === "skipped"
        ? "Driver visit is removed for this month."
        : "Choose whether your home should be on this month’s route.";

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
        trackMeta("InitiateCheckout", {
          currency: "USD",
          value: 5,
          content_name: "monthly_pickup_plan",
        });
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
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-white/15 bg-[linear-gradient(135deg,#111827_0%,#1f2937_58%,#ff6a00_180%)] p-5 text-white shadow-[0_20px_40px_rgba(17,24,39,0.16)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Current Cycle</p>
          <p className="mt-2 text-2xl font-bold">
            {nextPickupDate ? new Date(nextPickupDate).toLocaleDateString() : "Not scheduled"}
          </p>
          <p className="mt-2 text-sm text-white/80">{currentLabel}</p>
          <p className="mt-2 text-sm text-white/70">{actionSummary}</p>
          {localUpdatedAt ? (
            <p className="mt-3 text-xs text-white/60">Last saved {new Date(localUpdatedAt).toLocaleString()}</p>
          ) : null}
        </div>
        <div className="rounded-[1.75rem] border border-black/5 bg-[linear-gradient(180deg,#faf8f5_0%,#eee8e0_100%)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">What to know now</p>
          <p className="mt-2 text-lg font-bold">{urgency.label}</p>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">{urgency.detail}</p>
          {requestCutoffAt ? (
            <p className="mt-3 text-xs text-[var(--dc-gray-700)]">
              Response deadline: {new Date(requestCutoffAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>
      {!profileComplete ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_100%)] p-4 text-sm text-amber-900">
          Add your phone number and full pickup address in Profile before route planning begins.
        </div>
      ) : null}
      {cutoffPassed ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_100%)] p-4 text-sm text-amber-900">
          The response cutoff for this cycle has passed. Contact support if you need a manual change.
        </div>
      ) : null}
      <div className="rounded-[1.75rem] border border-black/5 bg-[rgba(255,255,255,0.74)] p-4 shadow-[0_12px_30px_rgba(17,24,39,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">Choose your status</p>
            <p className="mt-1 text-sm text-[var(--dc-gray-700)]">These actions update this cycle only and save immediately.</p>
          </div>
          <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[var(--dc-gray-700)]">
            Changes apply to this month
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => post("/api/pickup/request")}
            disabled={state === "loading" || cutoffPassed}
            className="rounded-[1.35rem] bg-[var(--dc-orange)] px-4 py-4 text-left text-sm font-semibold text-white shadow-[0_14px_30px_rgba(255,106,0,0.28)] disabled:opacity-60"
          >
            <span className="block">Confirm pickup</span>
            <span className="mt-1 block text-xs font-medium text-white/75">
              {localStatus === "requested" || localStatus === "confirmed" ? "Keep your stop active on the route." : "Tell ops your bag will be out."}
            </span>
          </button>
          <button
            onClick={() => post("/api/pickup/skip")}
            disabled={state === "loading" || cutoffPassed}
            className="rounded-[1.35rem] border border-black/10 bg-white px-4 py-4 text-left text-sm font-semibold text-black shadow-sm disabled:opacity-60"
          >
            <span className="block">Skip this month</span>
            <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-700)]">
              Remove your home from this cycle without changing billing.
            </span>
          </button>
          {localStatus === "skipped" ? (
            <button
              onClick={() => post("/api/pickup/unskip")}
              disabled={state === "loading" || cutoffPassed}
              className="rounded-[1.35rem] border border-black/10 bg-white px-4 py-4 text-left text-sm font-semibold text-black shadow-sm disabled:opacity-60"
            >
              <span className="block">Put me back on route</span>
              <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-700)]">
                Undo the skip before the cutoff passes.
              </span>
            </button>
          ) : (
            <a
              href="/app/profile"
              className="rounded-[1.35rem] border border-black/10 bg-white px-4 py-4 text-left text-sm font-semibold text-black shadow-sm"
            >
              <span className="block">Review profile</span>
              <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-700)]">
                Make sure your address and phone are current for routing.
              </span>
            </a>
          )}
          <button
            onClick={startCheckout}
            disabled={state === "loading"}
            className="rounded-[1.35rem] border border-black/10 bg-white px-4 py-4 text-left text-sm font-semibold text-black shadow-sm disabled:opacity-60"
          >
            <span className="block">Manage billing</span>
            <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-700)]">
              Update payment details or reopen Stripe checkout.
            </span>
          </button>
        </div>
      </div>
      {message ? (
        <p
          className={`rounded-[1.25rem] border px-4 py-3 text-sm ${
            state === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}
      <div className="rounded-[1.5rem] border border-black/10 bg-white/80 p-4 text-sm text-[var(--dc-gray-700)] shadow-sm">
        Skipping a month only removes your stop from this cycle. It does not pause your membership or change billing.
      </div>
    </div>
  );
}
