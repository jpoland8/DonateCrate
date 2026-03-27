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
  const statusPanelClassName = isSkipped
    ? "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffe4e6_100%)] text-rose-950"
    : "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-950";
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
      {/* Status chip */}
      <div className={`dc-badge ${isSkipped ? "dc-badge-danger" : "dc-badge-success"} !py-2 !px-4 !text-sm`}>
        {isSkipped ? (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="mr-1.5 h-4 w-4" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="mr-1.5 h-4 w-4" aria-hidden>
            <path d="M3.5 8.5l3 3 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {statusChipLabel}
      </div>

      {/* Status panels */}
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-[var(--radius-lg)] border p-5 shadow-sm ${statusPanelClassName}`}>
          <p className="dc-eyebrow !text-current opacity-60">Route Status</p>
          <p className="mt-2 text-2xl font-bold">{routeHeadline}</p>
          <p className="mt-2 text-sm opacity-80">
            {nextPickupDate ? `Pickup date: ${safeDateLabel(nextPickupDate, "Not scheduled")}` : "Pickup date is not scheduled yet."}
          </p>
          <p className="mt-2 text-sm opacity-80">{routeDetail}</p>
          {localUpdatedAt ? (
            <p className="mt-3 text-xs opacity-60">Last saved {safeDateTimeLabel(localUpdatedAt, "recently")}</p>
          ) : null}
        </div>
        <div className="dc-card p-5">
          <p className="dc-eyebrow !text-[var(--dc-gray-500)]">What to do now</p>
          <p className="mt-2 text-lg font-bold text-[var(--dc-gray-900)]">{nextStepTitle}</p>
          <p className="mt-2 text-sm text-[var(--dc-gray-600)]">{nextStepDetail}</p>
          {!cutoffPassed ? <p className={`mt-3 text-xs font-semibold uppercase tracking-[0.16em] ${urgencyAccentClassName}`}>{urgency.label}</p> : null}
          {!cutoffPassed ? <p className="mt-1 text-sm text-[var(--dc-gray-600)]">{urgency.detail}</p> : null}
          {requestCutoffAt ? (
            <p className="mt-3 text-xs text-[var(--dc-gray-500)]">
              Response deadline: {safeDateTimeLabel(requestCutoffAt, "Not set")}
            </p>
          ) : null}
        </div>
      </div>

      {/* Warnings */}
      {!profileComplete ? (
        <div className="dc-toast dc-toast-warning">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Add your phone number and full pickup address in Profile before route planning begins.
        </div>
      ) : null}
      {cutoffPassed ? (
        <div className="dc-toast dc-toast-warning">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          The response cutoff for this cycle has passed. Contact support if you need a manual change.
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="dc-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="dc-eyebrow !text-[var(--dc-gray-500)]">Change this month only</p>
            <p className="mt-1 text-sm text-[var(--dc-gray-600)]">
              {isSkipped
                ? "You are currently skipped. Put yourself back on the route if this was a mistake."
                : "You are currently on the route. Only skip if you do not want a pickup visit this month."}
            </p>
          </div>
          <span className="dc-badge dc-badge-neutral">Changes apply to this month</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => post("/api/pickup/request")}
            disabled={state === "loading" || cutoffPassed}
            className="dc-card-interactive rounded-[var(--radius-md)] border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm font-semibold text-emerald-900 disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="block">{isSkipped ? "Put me back on the route" : "Keep me on the route"}</span>
            <span className="mt-1 block text-xs font-medium text-emerald-600">
              {isSkipped ? "Include your home in this month\u2019s pickup again." : "Stay included for this month\u2019s pickup."}
            </span>
          </button>
          <button
            onClick={() => post("/api/pickup/skip")}
            disabled={state === "loading" || cutoffPassed}
            className="dc-card-interactive rounded-[var(--radius-md)] border-rose-200 bg-rose-50 px-4 py-4 text-left text-sm font-semibold text-rose-900 disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="block">Skip this month</span>
            <span className="mt-1 block text-xs font-medium text-rose-600">
              Take your home off this month&apos;s route without changing billing.
            </span>
          </button>
          {isSkipped ? (
            <div className="dc-inner-panel text-left text-sm">
              <span className="block font-semibold text-[var(--dc-gray-900)]">No pickup visit scheduled</span>
              <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-500)]">
                A driver will not stop by this month unless you put yourself back on the route.
              </span>
            </div>
          ) : (
            <div className="dc-inner-panel border-emerald-100 bg-emerald-50/50 text-left text-sm">
              <span className="block font-semibold text-emerald-900">Pickup visit scheduled</span>
              <span className="mt-1 block text-xs font-medium text-emerald-600">
                Your home is included and no further action is needed right now.
              </span>
            </div>
          )}
          {localStatus === "skipped" ? (
            <button
              onClick={() => post("/api/pickup/unskip")}
              disabled={state === "loading" || cutoffPassed}
              className="dc-card-interactive rounded-[var(--radius-md)] border-emerald-200 bg-emerald-50 px-4 py-4 text-left text-sm font-semibold text-emerald-900 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="block">Put me back on route</span>
              <span className="mt-1 block text-xs font-medium text-emerald-600">
                Undo the skip before the cutoff passes.
              </span>
            </button>
          ) : (
            <a
              href="/app/profile"
              className="dc-card-interactive rounded-[var(--radius-md)] px-4 py-4 text-left text-sm font-semibold text-[var(--dc-gray-900)]"
            >
              <span className="block">Review profile</span>
              <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-500)]">
                Make sure your address and phone are current for routing.
              </span>
            </a>
          )}
          <button
            onClick={startCheckout}
            disabled={state === "loading"}
            className="dc-card-interactive rounded-[var(--radius-md)] px-4 py-4 text-left text-sm font-semibold text-[var(--dc-gray-900)] disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="block">Manage billing</span>
            <span className="mt-1 block text-xs font-medium text-[var(--dc-gray-500)]">
              Update payment details or reopen Stripe checkout.
            </span>
          </button>
        </div>
      </div>

      {/* Feedback message */}
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
      <div className="dc-card p-4 text-sm text-[var(--dc-gray-600)]">
        {footerNote}
      </div>
    </div>
  );
}
