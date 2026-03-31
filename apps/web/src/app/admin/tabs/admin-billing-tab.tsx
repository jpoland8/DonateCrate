"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminData, AdminSubscription } from "../admin-types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatCardExpiry,
  formatStatusLabel,
} from "../admin-utils";

/* ------------------------------------------------------------------ */
/*  Billing-specific display helpers                                  */
/* ------------------------------------------------------------------ */

function getBillingStatusTone(status: string) {
  switch (status) {
    case "active":
      return "admin-badge-green";
    case "trialing":
      return "admin-badge-slate";
    case "past_due":
      return "admin-badge-amber";
    case "paused":
      return "admin-badge-indigo";
    case "canceled":
      return "admin-badge-red";
    default:
      return "border-admin bg-admin-surface-strong text-admin";
  }
}

function getBillingStatusExplanation(subscription: AdminSubscription) {
  if (subscription.cancelAtPeriodEnd) {
    return `Cancellation is scheduled. Access continues until ${formatDate(subscription.currentPeriodEnd)}.`;
  }

  switch (subscription.status) {
    case "active":
      return "Account is in good standing and should renew automatically on the next billing date.";
    case "trialing":
      return "Customer began checkout but billing has not fully activated yet. Ask them to complete payment before pickup access is restored.";
    case "past_due":
      return "Stripe could not collect the latest invoice. Payment details and invoice status need review.";
    case "paused":
      return "Collection is paused in Stripe. Billing will not continue until the subscription is resumed.";
    case "canceled":
      return subscription.canceledAt
        ? `Subscription was canceled on ${formatDateTime(subscription.canceledAt)}.`
        : "Subscription is canceled and no further renewals will occur.";
    default:
      return "Subscription state is available but should be refreshed from Stripe for confirmation.";
  }
}

function getPaymentPreviewLabel(subscription: AdminSubscription) {
  if (!subscription.paymentMethod) return "Payment method unavailable";
  if (subscription.paymentMethod.type !== "card") {
    return subscription.paymentMethod.type || "Stored payment method";
  }
  return `${subscription.paymentMethod.brand || "card"} ending in ${subscription.paymentMethod.last4 || "----"}`;
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export type AdminBillingTabProps = {
  data: AdminData;
  setAdminData: React.Dispatch<React.SetStateAction<AdminData>>;
  setMessage: (msg: string) => void;
  loadAll: () => Promise<void>;
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function AdminBillingTab({ data, setAdminData, setMessage, loadAll }: AdminBillingTabProps) {
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<
    "all" | "active" | "past_due" | "paused" | "canceled"
  >("all");
  const [subscriptionActionState, setSubscriptionActionState] = useState<{ id: string; action: string } | null>(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("");

  const filteredSubscriptions = useMemo(() => {
    if (!data) return [];
    const query = subscriptionSearch.trim().toLowerCase();
    return data.subscriptions.filter((subscription) => {
      const matchesQuery =
        query.length === 0 ||
        subscription.user.email.toLowerCase().includes(query) ||
        (subscription.user.fullName || "").toLowerCase().includes(query) ||
        (subscription.stripeSubscriptionId || "").toLowerCase().includes(query) ||
        (subscription.stripeCustomerId || "").toLowerCase().includes(query);
      const matchesStatus = subscriptionStatusFilter === "all" || subscription.status === subscriptionStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data, subscriptionSearch, subscriptionStatusFilter]);

  const selectedSubscription = useMemo(
    () => filteredSubscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ?? null,
    [filteredSubscriptions, selectedSubscriptionId],
  );

  useEffect(() => {
    if (filteredSubscriptions.length === 0 || selectedSubscriptionId.length === 0) {
      setSelectedSubscriptionId("");
      return;
    }
    if (!filteredSubscriptions.some((subscription) => subscription.id === selectedSubscriptionId)) {
      setSelectedSubscriptionId(filteredSubscriptions[0].id);
    }
  }, [filteredSubscriptions, selectedSubscriptionId]);

  async function runSubscriptionAction(
    subscriptionId: string,
    action: "sync" | "schedule_cancel" | "resume" | "cancel_now",
  ) {
    if (action === "cancel_now") {
      const confirmed = window.confirm(
        "Cancel this subscription immediately in Stripe? This stops billing now and can impact customer access.",
      );
      if (!confirmed) return;
    }
    setSubscriptionActionState({ id: subscriptionId, action });
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, action }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(json.error || "Could not update Stripe subscription");

      if (json.subscription) {
        setAdminData((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((subscription) =>
            subscription.id === json.subscription.id ? json.subscription : subscription,
          ),
        }));
      }

      const successMessage =
        action === "sync"
          ? "Billing record refreshed from Stripe."
          : action === "schedule_cancel"
            ? "Subscription will end at the close of the current billing period."
            : action === "resume"
              ? json.restarted
                ? "A new Stripe subscription was created and billing has been restarted."
                : "Auto-renewal has been restored."
              : "Subscription canceled immediately.";

      setMessage(successMessage);
      await loadAll();
    } catch {
      setMessage("Could not reach Stripe billing service.");
    } finally {
      setSubscriptionActionState(null);
    }
  }

  return (
    <section className="space-y-4">
      <article
        className="rounded-3xl border p-6"
        style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Billing Control</p>
        <h2 className="mt-2 text-2xl font-bold">Manage Stripe subscriptions without leaving DonateCrate</h2>
        <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--admin-muted)" }}>
          Keep the roster readable in one line. Expand only the subscriber you need to inspect, then manage Stripe
          actions, invoice state, and payment-method preview inline.
        </p>
      </article>

      <div className="grid gap-4 lg:grid-cols-4">
        <article className="dc-stat-admin">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Active Subscribers</p>
          <p className="mt-3 text-3xl font-bold">
            {data.subscriptions.filter((subscription) => subscription.status === "active").length}
          </p>
        </article>
        <article className="dc-stat-admin">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Ending This Period</p>
          <p className="mt-3 text-3xl font-bold">
            {data.subscriptions.filter((subscription) => subscription.cancelAtPeriodEnd).length}
          </p>
        </article>
        <article className="dc-stat-admin">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Needs Attention</p>
          <p className="mt-3 text-3xl font-bold">
            {data.subscriptions.filter((subscription) => ["past_due", "canceled"].includes(subscription.status)).length}
          </p>
        </article>
        <article className="dc-stat-admin">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--admin-soft-text)" }}>Saved Card on File</p>
          <p className="mt-3 text-3xl font-bold">
            {data.subscriptions.filter((subscription) => subscription.paymentMethod?.type === "card").length}
          </p>
        </article>
      </div>

      <article className="dc-stat-admin !p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Subscriber billing roster</p>
            <p className="mt-1 text-xs" style={{ color: "var(--admin-soft-text)" }}>
              Search by subscriber, Stripe customer ID, or Stripe subscription ID. Click any row to expand the full billing detail.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={subscriptionSearch}
              onChange={(event) => setSubscriptionSearch(event.target.value)}
              placeholder="Search billing records"
              className="dc-input-admin min-w-0"
            />
            <select
              value={subscriptionStatusFilter}
              onChange={(event) =>
                setSubscriptionStatusFilter(
                  event.target.value as "all" | "active" | "past_due" | "paused" | "canceled",
                )
              }
              className="dc-input-admin"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="past_due">Past due</option>
              <option value="paused">Paused</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>
      </article>

      <section className="space-y-3">
        {filteredSubscriptions.map((subscription) => {
          const isOpen = selectedSubscription?.id === subscription.id;
          const actionBusy = subscriptionActionState?.id === subscription.id;
          const isEnded = subscription.status === "canceled";
          const canScheduleCancel = !isEnded && !subscription.cancelAtPeriodEnd && !!subscription.stripeSubscriptionId;
          const canResume =
            (subscription.cancelAtPeriodEnd && !!subscription.stripeSubscriptionId) ||
            (isEnded && !!subscription.stripeCustomerId && !!subscription.plan.stripePriceId);

          return (
            <article
              key={subscription.id}
              className="overflow-hidden rounded-3xl border transition"
              style={{
                borderColor: isOpen ? "var(--dc-orange)" : "var(--admin-border)",
                background: isOpen
                  ? "linear-gradient(160deg, rgba(255,106,0,0.1), var(--admin-surface-strong))"
                  : "var(--admin-surface)",
                boxShadow: isOpen ? "0 18px 45px rgba(0,0,0,0.12)" : "none",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedSubscriptionId(isOpen ? "" : subscription.id)}
                className="w-full px-4 py-4 text-left"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_120px_170px_170px_220px_32px] xl:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{subscription.user.fullName || subscription.user.email}</p>
                    <p className="truncate text-xs" style={{ color: "var(--admin-soft-text)" }}>{subscription.user.email}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Status</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${getBillingStatusTone(subscription.status)}`}>
                      {formatStatusLabel(subscription.status)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Plan</p>
                    <p className="mt-1 text-sm font-medium">{formatCurrency(subscription.plan.amountCents, subscription.plan.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Renews / ends</p>
                    <p className="mt-1 text-sm font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--admin-soft-text)" }}>Payment preview</p>
                    <p className="mt-1 truncate text-sm font-medium">{getPaymentPreviewLabel(subscription)}</p>
                  </div>
                  <div className="text-right text-lg font-semibold" style={{ color: "var(--admin-soft-text)" }}>
                    {isOpen ? "\u2212" : "+"}
                  </div>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: "var(--admin-border)" }}>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="space-y-4">
                      <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Subscription Overview</p>
                            <h3 className="mt-2 text-2xl font-bold">{subscription.user.fullName || subscription.user.email}</h3>
                            <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>{subscription.user.phone || "Phone not on file"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${getBillingStatusTone(subscription.status)}`}>
                              {formatStatusLabel(subscription.status)}
                            </span>
                            <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-muted)" }}>
                              {subscription.cancelAtPeriodEnd ? "Cancellation scheduled" : "Recurring billing on"}
                            </span>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-6" style={{ color: "var(--admin-muted)" }}>
                          {getBillingStatusExplanation(subscription)}
                        </p>
                      </article>

                      <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "linear-gradient(135deg,#ff6a00 0%, #d45a07 38%, #f4ede7 100%)", color: "#ffffff" }}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-admin-muted">Payment method preview</p>
                            <p className="mt-2 text-2xl font-bold capitalize">
                              {subscription.paymentMethod?.brand || subscription.paymentMethod?.type || "Unavailable"}
                            </p>
                          </div>
                          <span className="rounded-full border border-admin-strong bg-admin-surface-strong px-3 py-1 text-xs font-semibold text-admin-muted">
                            {subscription.paymentMethod?.funding || "stored"}
                          </span>
                        </div>
                        <p className="mt-12 font-mono text-2xl tracking-[0.28em] text-admin">
                          &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; {subscription.paymentMethod?.last4 || "----"}
                        </p>
                        <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-admin-soft">Card expires</p>
                            <p className="mt-1 font-semibold">{formatCardExpiry(subscription.paymentMethod?.expMonth ?? null, subscription.paymentMethod?.expYear ?? null)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-admin-soft">Country</p>
                            <p className="mt-1 font-semibold">{subscription.paymentMethod?.country || "Unknown"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-admin-soft">Charge amount</p>
                            <p className="mt-1 font-semibold">{formatCurrency(subscription.plan.amountCents, subscription.plan.currency)}</p>
                          </div>
                        </div>
                      </article>
                    </div>

                    <div className="space-y-4">
                      <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">Timeline and invoice</p>
                            <p className="mt-1 text-xs" style={{ color: "var(--admin-soft-text)" }}>Renewal timing, latest invoice status, and Stripe record links.</p>
                          </div>
                          {subscription.latestInvoice?.hostedInvoiceUrl ? (
                            <a
                              href={subscription.latestInvoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border px-3 py-2 text-xs font-semibold hover:bg-admin-surface-strong"
                              style={{ borderColor: "var(--admin-border-strong)", color: "var(--admin-text)" }}
                            >
                              Open invoice
                            </a>
                          ) : null}
                        </div>
                        <div className="mt-4 space-y-3">
                          {[
                            ["Period started", formatDate(subscription.currentPeriodStart)],
                            ["Next renewal / access end", formatDate(subscription.currentPeriodEnd)],
                            ["Latest invoice status", subscription.latestInvoiceStatus || "Unavailable"],
                            ["Last Stripe sync", formatDateTime(subscription.updatedAt)],
                            [
                              "Invoice amount due",
                              subscription.latestInvoice
                                ? formatCurrency(subscription.latestInvoice.amountDueCents, subscription.latestInvoice.currency || subscription.plan.currency)
                                : "Not available",
                            ],
                            [
                              "Invoice amount paid",
                              subscription.latestInvoice
                                ? formatCurrency(subscription.latestInvoice.amountPaidCents, subscription.latestInvoice.currency || subscription.plan.currency)
                                : "Not available",
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="flex items-center justify-between rounded-2xl border px-4 py-3 text-sm"
                              style={{ borderColor: "var(--admin-border)", background: "var(--admin-panel)" }}
                            >
                              <span style={{ color: "var(--admin-muted)" }}>{label}</span>
                              <span className="font-semibold" style={{ color: "var(--admin-text)" }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="rounded-[28px] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-strong)" }}>
                        <p className="text-sm font-semibold">Stripe controls</p>
                        <p className="mt-1 text-xs" style={{ color: "var(--admin-soft-text)" }}>
                          Refresh the Stripe record, schedule end-of-term cancellation, restore auto-renew, or cancel immediately.
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => runSubscriptionAction(subscription.id, "sync")}
                            disabled={actionBusy}
                            className="rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-admin-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ borderColor: "var(--admin-border-strong)", background: "var(--admin-panel)" }}
                          >
                            {actionBusy && subscriptionActionState?.action === "sync" ? "Refreshing..." : "Refresh from Stripe"}
                          </button>
                          <button
                            type="button"
                            onClick={() => runSubscriptionAction(subscription.id, "schedule_cancel")}
                            disabled={actionBusy || !canScheduleCancel}
                            className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 admin-badge-amber"
                          >
                            {subscription.cancelAtPeriodEnd ? "Cancellation scheduled" : "End after current period"}
                          </button>
                          <button
                            type="button"
                            onClick={() => runSubscriptionAction(subscription.id, "resume")}
                            disabled={actionBusy || !canResume}
                            className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 admin-badge-green"
                          >
                            {isEnded ? "Restart subscription" : "Restore auto-renew"}
                          </button>
                          <button
                            type="button"
                            onClick={() => runSubscriptionAction(subscription.id, "cancel_now")}
                            disabled={actionBusy || isEnded || !subscription.stripeSubscriptionId}
                            className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 admin-badge-red"
                          >
                            {actionBusy && subscriptionActionState?.action === "cancel_now" ? "Canceling..." : "Cancel immediately"}
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 text-xs" style={{ color: "var(--admin-soft-text)" }}>
                          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-panel)" }}>
                            Stripe customer: <span className="font-mono" style={{ color: "var(--admin-text)" }}>{subscription.stripeCustomerId || "Not linked"}</span>
                          </div>
                          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-panel)" }}>
                            Stripe subscription: <span className="font-mono" style={{ color: "var(--admin-text)" }}>{subscription.stripeSubscriptionId || "Not linked"}</span>
                          </div>
                        </div>
                      </article>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
        {filteredSubscriptions.length === 0 ? (
          <article
            className="dc-stat-admin border-dashed !p-8 text-sm"
            style={{ color: "var(--admin-soft-text)" }}
          >
            No billing records match the current search or status filters.
          </article>
        ) : null}
      </section>
    </section>
  );
}
