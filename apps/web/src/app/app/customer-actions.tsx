"use client";

import { useState } from "react";
import { getCycleUrgency } from "@/lib/customer-cycle";
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
  const isSkipped = localStatus === "skipped";
  const statusChipLabel = isSkipped ? "Skipped This Month" : "On This Month's Route";
  const statusChipClassName = isSkipped
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const statusPanelClassName = isSkipped
    ? "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffe4e6_100%)] text-rose-950 shadow-[0_20px_40px_rgba(244,63,94,0.10)]"
    : "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-950 shadow-[0_20px_40px_rgba(16,185,129,0.12)]";
  const routeHeadline = isSkipped
    ? "You are skipped for this month's pickup"
    : "You are on this month's pickup route";
  const routeDetail = isSkipped
    ? "A driver will not stop at your home this cycle unless you put yourself back on the route before the deadline."
    : "Your home is included for this cycle. You do not need to do anything else unless your plans changed.";
  const nextStepTitle = cutoffPassed
    ? "The route is already locked"
    : isSkipped
      ? "You are currently marked skipped"
      : "You are already set for pickup";
  const nextStepDetail = cutoffPassed
    ? "The response deadline has passed for this cycle. Contact support if you need a manual change."
    : isSkipped
      ? "If you changed your mind, use Put me back on the route before the response deadline."
      : "You can leave everything as-is. Only choose Skip this month if you do not want a pickup visit this cycle.";
  const urgencyAccentClassName = isSkipped ? "text-rose-600" : "text-[var(--dc-orange)]";
  const footerNote = isSkipped
    ? "Skipped only applies to this month. Your membership and billing stay active."
    : "You are included for this month. You only need to act if you want to skip this pickup.";

  function safeDateLabel(value: string | null, fallback: string) {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString();
  }

  function safeDateTimeLabel(value: string | null, fallback: string) {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
  }

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
        setMessage("You are on the route for this month.");
      } else if (path.endsWith("/skip")) {
        setMessage("You are skipped for this month. Billing stays unchanged.");
      } else {
        setMessage("You are back on the route for this month.");
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
      <div className={`rounded-[1.5rem] border px-4 py-3 text-sm font-semibold shadow-sm ${statusChipClassName}`}>
        {statusChipLabel}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-[1.75rem] border p-5 ${statusPanelClassName}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Route Status</p>
          <p className="mt-2 text-2xl font-bold">{routeHeadline}</p>
          <p className="mt-2 text-sm opacity-80">
            {nextPickupDate ? `Pickup date: ${safeDateLabel(nextPickupDate, "Not scheduled")}` : "Pickup date is not scheduled yet."}
          </p>
          <p className="mt-2 text-sm opacity-80">{routeDetail}</p>
          {localUpdatedAt ? (
            <p className="mt-3 text-xs opacity-70">Last saved {safeDateTimeLabel(localUpdatedAt, "recently")}</p>
          ) : null}
        </div>
        <div className="rounded-[1.75rem] border border-black/5 bg-[linear-gradient(180deg,#faf8f5_0%,#eee8e0_100%)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">What to do now</p>
          <p className="mt-2 text-lg font-bold">{nextStepTitle}</p>
          <p className="mt-2 text-sm text-[var(--dc-gray-700)]">{nextStepDetail}</p>
          {!cutoffPassed ? <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] ${urgencyAccentClassName}`}>{urgency.label}</p> : null}
          {!cutoffPassed ? <p className="mt-1 text-sm text-[var(--dc-gray-700)]">{urgency.detail}</p> : null}
          {requestCutoffAt ? (
            <p className="mt-3 text-xs text-[var(--dc-gray-700)]">
              Response deadline: {safeDateTimeLabel(requestCutoffAt, "Not set")}
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">Change this month only</p>
            <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
              {isSkipped
                ? "You are currently skipped. Put yourself back on the route if this was a mistake."
                : "You are currently on the route. Only skip if you do not want a pickup visit this month."}
            </p>
          </div>
          <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[var(--dc-gray-700)]">
            Changes apply to this month
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => post("/api/pickup/request")}
            disabled={state === "loading" || cutoffPassed}
            className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm font-semibold text-emerald-900 shadow-sm disabled:opacity-60"
          >
            <span className="block">{isSkipped ? "Put me back on the route" : "Keep me on the route"}</span>
            <span className="mt-1 block text-xs font-medium text-emerald-700">
              {isSkipped ? "Include your home in this month&apos;s pickup again." : "Stay included for this month&apos;s pickup."}
            </span>
          </button>
          <button
            onClick={() => post("/api/pickup/skip")}
            disabled={state === "loading" || cutoffPassed}
            className="rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-4 text-left text-sm font-semibold text-rose-900 shadow-sm disabled:opacity-60"
          >
            <span className="block">Skip this month</span>
            <span className="mt-1 block text-xs font-medium text-rose-700">
              Take your home off this month&apos;s route without changing billing.
            </span>
          </button>
          {isSkipped ? (
            <div className="rounded-[1.35rem] border border-black/10 bg-white px-4 py-4 text-left text-sm shadow-sm">
              <span className="block font-semibold text-black">No pickup visit scheduled</span>
              <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-700)]">
                A driver will not stop by this month unless you put yourself back on the route.
              </span>
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm shadow-sm">
              <span className="block font-semibold text-emerald-900">Pickup visit scheduled</span>
              <span className="mt-1 block text-xs font-medium text-emerald-700">
                Your home is included and no further action is needed right now.
              </span>
            </div>
          )}
          {localStatus === "skipped" ? (
            <button
              onClick={() => post("/api/pickup/unskip")}
              disabled={state === "loading" || cutoffPassed}
              className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm font-semibold text-emerald-900 shadow-sm disabled:opacity-60"
            >
              <span className="block">Put me back on route</span>
              <span className="mt-1 block text-xs font-medium text-emerald-700">
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
        {footerNote}
      </div>
    </div>
  );
}
