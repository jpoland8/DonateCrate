"use client";

import { useState } from "react";

export function PaymentWall() {
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
    <section className="rounded-3xl border border-black/10 bg-white p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--dc-gray-700)]">Billing Required</p>
      <h2 className="mt-2 text-3xl font-bold">Unlock Full Customer Portal Access</h2>
      <p className="mt-3 max-w-3xl text-sm text-[var(--dc-gray-700)]">
        Activate your monthly DonateCrate plan to submit pickup requests, manage route-ready status, and keep your
        notifications synced. Billing is handled securely through Stripe.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={startCheckout}
          disabled={status === "loading"}
          className="rounded-xl bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
        >
          {status === "loading" ? "Working..." : "Start $5/month Plan"}
        </button>
        {allowTestBypass ? (
          <button
            onClick={bypassForTesting}
            disabled={status === "loading"}
            className="rounded-xl border border-black px-4 py-2 text-sm font-semibold disabled:opacity-70"
          >
            Test Bypass
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
    </section>
  );
}
