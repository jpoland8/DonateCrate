"use client";

import { useState } from "react";
import { trackMeta } from "@/lib/meta-pixel";

export function PaymentWall({
  checkoutStatus,
  onboardingCreated,
  hasAppliedReferral = false,
}: {
  checkoutStatus?: "success" | "canceled" | null;
  onboardingCreated?: boolean;
  hasAppliedReferral?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  // Referral code entry (first-time users only)
  const [referralInput, setReferralInput] = useState("");
  const [referralStatus, setReferralStatus] = useState<"idle" | "saving" | "applied" | "error">(
    hasAppliedReferral ? "applied" : "idle",
  );
  const [referralMessage, setReferralMessage] = useState(
    hasAppliedReferral ? "Referral code applied! Your first month will be free — subscribe above to activate." : "",
  );

  async function applyReferralCode() {
    const code = referralInput.trim().toUpperCase();
    if (!code) return;
    setReferralStatus("saving");
    setReferralMessage("");
    try {
      const res = await fetch("/api/referrals/apply-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: code }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setReferralStatus("applied");
        setReferralMessage("Referral code applied! Your first month will be free — subscribe above to activate.");
      } else {
        setReferralStatus("error");
        setReferralMessage(json.error || "Could not apply referral code.");
      }
    } catch {
      setReferralStatus("error");
      setReferralMessage("Could not reach server. Try again.");
    }
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

  async function startCheckout() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetchWithTimeout("/api/billing/checkout-session", { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("error");
        setMessage(json.error || "Unable to open Stripe checkout.");
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
      setStatus("error");
      setMessage("Checkout URL was not returned.");
    } catch {
      setStatus("error");
      setMessage("Unable to reach billing right now. Please try again.");
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_20px_50px_rgba(20,14,8,0.06)]">
      <div className="border-b border-black/6 bg-[linear-gradient(135deg,#fff1e6_0%,#ffffff_52%,#f7f8fb_100%)] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-orange)]">Billing Required</p>
        <h2 className="mt-2 text-3xl font-bold">Finish setup to unlock pickup requests</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--dc-gray-700)]">
          Activate your monthly DonateCrate plan to request pickups, manage your status for the month, and stay in
          sync with reminder notifications. Billing is handled securely through Stripe.
        </p>
      </div>
      <div className="p-6">
      {checkoutStatus === "success" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Billing was activated successfully. If your account still looks locked for a moment, refresh the page and we
          will re-check your status.
        </div>
      ) : null}
      {onboardingCreated ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Your account details are saved. Billing is the last step before you can request this month&apos;s pickup.
        </div>
      ) : null}
      {checkoutStatus === "canceled" ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Checkout was canceled before activation. Your account is still available, and you can restart billing below.
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={startCheckout}
          disabled={status === "loading"}
          className="rounded-2xl bg-[var(--dc-orange)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {status === "loading" ? "Working..." : "Start $5/month Plan"}
        </button>
      </div>
      <div className="mt-5 grid gap-3 text-sm text-[var(--dc-gray-700)] sm:grid-cols-3">
        <div className="rounded-[1.5rem] bg-[var(--dc-gray-100)] p-4">
          <p className="font-semibold text-black">1. Activate plan</p>
          <p className="mt-1">Secure checkout starts your $5/month household subscription.</p>
        </div>
        <div className="rounded-[1.5rem] bg-[var(--dc-gray-100)] p-4">
          <p className="font-semibold text-black">2. Pick your month</p>
          <p className="mt-1">Return here to request this cycle&apos;s pickup or skip if you are not ready.</p>
        </div>
        <div className="rounded-[1.5rem] bg-[var(--dc-gray-100)] p-4">
          <p className="font-semibold text-black">3. Set out your bag</p>
          <p className="mt-1">We will send reminders before route day so your donation is ready on time.</p>
        </div>
      </div>
      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}

      {/* Referral code entry — only for users who haven't paid yet */}
      {referralStatus !== "applied" ? (
        <div className="mt-6 border-t border-black/6 pt-5">
          <p className="text-sm font-semibold text-[var(--dc-gray-700)]">Have a referral code?</p>
          <p className="mt-0.5 text-xs text-[var(--dc-gray-500)]">
            Enter it before subscribing and your first month will be free. Your referrer earns a $5 credit too.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              placeholder="e.g. DCABC123"
              maxLength={20}
              className="h-10 flex-1 rounded-xl border border-black/15 px-3 text-sm font-mono tracking-wider"
            />
            <button
              type="button"
              onClick={applyReferralCode}
              disabled={referralStatus === "saving" || !referralInput.trim()}
              className="rounded-xl bg-[var(--dc-gray-900)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {referralStatus === "saving" ? "Applying..." : "Apply"}
            </button>
          </div>
          {referralMessage ? (
            <p className={`mt-2 text-xs font-medium ${referralStatus === "error" ? "text-red-600" : "text-emerald-700"}`}>
              {referralMessage}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-semibold text-emerald-900">{referralMessage || "Referral code applied! You'll earn a $5 credit when you subscribe."}</p>
        </div>
      )}
      </div>
    </section>
  );
}
