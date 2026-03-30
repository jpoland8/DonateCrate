"use client";

import { useState } from "react";
import { getCycleUrgency } from "@/lib/customer-cycle";
import { trackMeta } from "@/lib/meta-pixel";
import { Spinner } from "@/components/ui/spinner";

type ActionState = "idle" | "loading" | "error" | "success";

type CustomerActionsProps = {
  nextPickupDate: string | null;
  currentStatus: string | null;
  lastUpdatedAt?: string | null;
  profileComplete?: boolean;
};

export function CustomerActions({
  nextPickupDate,
  currentStatus,
  lastUpdatedAt = null,
  profileComplete = true,
}: CustomerActionsProps) {
  const [state, setState] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");
  const [localStatus, setLocalStatus] = useState(currentStatus);
  const [localUpdatedAt, setLocalUpdatedAt] = useState(lastUpdatedAt);

  const today = new Date().toISOString().slice(0, 10);
  const isLocked = nextPickupDate ? today >= nextPickupDate : false;
  const isSkipped = localStatus === "skipped";
  const urgency = getCycleUrgency(nextPickupDate, new Date());

  const statusPanelClass = isSkipped
    ? "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffe4e6_100%)] text-rose-950"
    : "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-950";

  const routeHeadline = isSkipped
    ? "Skipped this month"
    : "On this month's pickup route";

  const routeDetail = isLocked
    ? "The route for today is locked."
    : isSkipped
    ? "A driver will not stop at your home this cycle. Put yourself back on the route if plans changed."
    : "Your home is included. You do not need to do anything else unless your plans changed.";

  function safeDateLabel(value: string | null, fallback = "—") {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleDateString();
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
      if (path.endsWith("/skip")) {
        setMessage("Skipped for this month. Billing stays unchanged.");
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
        trackMeta("InitiateCheckout", { currency: "USD", value: 5, content_name: "monthly_pickup_plan" });
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
      {/* Route status card */}
      <div className={`rounded-[var(--radius-lg)] border p-5 shadow-sm ${statusPanelClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">Route Status</p>
            <p className="mt-1.5 text-2xl font-bold leading-tight">{routeHeadline}</p>
            {nextPickupDate && (
              <p className="mt-1.5 text-sm opacity-75">
                Pickup {safeDateLabel(nextPickupDate)}
              </p>
            )}
          </div>
          <span className={`dc-badge shrink-0 ${isSkipped ? "dc-badge-danger" : "dc-badge-success"}`}>
            {isSkipped ? "Skipped" : "On route"}
          </span>
        </div>
        <p className="mt-3 text-sm opacity-80">{routeDetail}</p>
        {urgency.tone !== "neutral" && !isLocked && (
          <p className={`mt-3 text-xs font-semibold uppercase tracking-[0.16em] ${isSkipped ? "text-rose-600" : "text-[var(--dc-orange)]"}`}>
            {urgency.label}
          </p>
        )}
        {localUpdatedAt && (
          <p className="mt-2 text-xs opacity-50">Saved {safeDateLabel(localUpdatedAt)}</p>
        )}
      </div>

      {/* Profile incomplete warning */}
      {!profileComplete && (
        <div className="dc-toast dc-toast-warning">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Add your phone number and full pickup address in Profile before route planning begins.
        </div>
      )}

      {/* Action buttons */}
      <div className="dc-card p-5">
        <p className="dc-eyebrow !text-[var(--dc-gray-500)]">Manage this month</p>
        <p className="mt-1 text-sm text-[var(--dc-gray-600)]">
          {isLocked
            ? "Pickup is today — changes are no longer accepted for this cycle."
            : isSkipped
            ? "You are skipped. Put yourself back on the route if plans changed."
            : "You are on the route. Only skip if you do not want a pickup this month."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {isSkipped ? (
            <button
              onClick={() => post("/api/pickup/unskip")}
              disabled={state === "loading" || isLocked}
              className="dc-card-interactive flex-1 rounded-[var(--radius-md)] border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm font-semibold text-emerald-900 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-40"
            >
              {state === "loading" ? (
                <span className="flex items-center gap-2"><Spinner size="sm" color="current" /><span>Saving...</span></span>
              ) : (
                <>
                  <span className="block">Back on the route</span>
                  <span className="mt-0.5 block text-xs font-medium text-emerald-600">
                    Include your home in this month's pickup.
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => post("/api/pickup/skip")}
              disabled={state === "loading" || isLocked}
              className="dc-card-interactive flex-1 rounded-[var(--radius-md)] border-rose-200 bg-rose-50 px-4 py-4 text-left text-sm font-semibold text-rose-900 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-40"
            >
              {state === "loading" ? (
                <span className="flex items-center gap-2"><Spinner size="sm" color="current" /><span>Saving...</span></span>
              ) : (
                <>
                  <span className="block">Skip this month</span>
                  <span className="mt-0.5 block text-xs font-medium text-rose-600">
                    Take your home off this month's route. Billing stays unchanged.
                  </span>
                </>
              )}
            </button>
          )}
          <button
            onClick={startCheckout}
            disabled={state === "loading"}
            className="dc-card-interactive flex-1 rounded-[var(--radius-md)] px-4 py-4 text-left text-sm font-semibold text-[var(--dc-gray-900)] disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-40"
          >
            {state === "loading" ? (
              <span className="flex items-center gap-2"><Spinner size="sm" color="current" /><span>Loading...</span></span>
            ) : (
              <>
                <span className="block">Manage billing</span>
                <span className="mt-0.5 block text-xs font-medium text-[var(--dc-gray-500)]">
                  Update payment or reopen Stripe checkout.
                </span>
              </>
            )}
          </button>
          <a
            href="/app/profile"
            className="dc-card-interactive flex-1 rounded-[var(--radius-md)] px-4 py-4 text-left text-sm font-semibold text-[var(--dc-gray-900)]"
          >
            <span className="block">Profile &amp; address</span>
            <span className="mt-0.5 block text-xs font-medium text-[var(--dc-gray-500)]">
              Keep your address and phone current for routing.
            </span>
          </a>
        </div>
      </div>

      {/* Feedback */}
      {message ? (
        <div className={`dc-toast ${state === "error" ? "dc-toast-error" : "dc-toast-success"}`}>
          {state === "error" ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          )}
          {message}
        </div>
      ) : null}

      {/* Footer note */}
      <p className="text-center text-sm text-[var(--dc-gray-500)]">
        {isLocked
          ? <>Need a manual change? <a href="mailto:support@donatecrate.com" className="font-semibold text-[var(--dc-orange)] hover:underline">Contact support</a>.</>
          : isSkipped
          ? "Skipped applies to this month only. Your membership and billing stay active."
          : "You are included this month. Only skip if you do not want a pickup visit."}
      </p>
    </div>
  );
}
