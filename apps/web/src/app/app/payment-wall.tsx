"use client";

import { useState } from "react";

export function PaymentWall({
  checkoutStatus,
  onboardingCreated,
}: {
  checkoutStatus?: "success" | "canceled" | null;
  onboardingCreated?: boolean;
}) {
  const allowTestBypass = process.env.NEXT_PUBLIC_ENABLE_TEST_BYPASS === "true";
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
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

  async function bypassForTesting() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetchWithTimeout("/api/billing/test-bypass", { method: "POST" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("error");
        setMessage(json.error || "Could not enable test bypass.");
        return;
      }
      window.location.reload();
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
        {allowTestBypass ? (
          <button
            onClick={bypassForTesting}
            disabled={status === "loading"}
            className="rounded-2xl border border-black px-5 py-3 text-sm font-semibold disabled:opacity-70"
          >
            Test Bypass
          </button>
        ) : null}
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
      </div>
    </section>
  );
}
