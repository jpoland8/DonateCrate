"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export function WaitlistForm() {
  const searchParams = useSearchParams();
  const defaultPostal = useMemo(() => searchParams.get("postalCode") || "", [searchParams]);
  const defaultReferral = useMemo(() => searchParams.get("ref") || "", [searchParams]);
  const defaultAddressLine1 = useMemo(() => searchParams.get("addressLine1") || "", [searchParams]);
  const defaultCity = useMemo(() => searchParams.get("city") || "", [searchParams]);
  const defaultState = useMemo(() => searchParams.get("state") || "", [searchParams]);

  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: String(form.get("fullName") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      addressLine1: String(form.get("addressLine1") || ""),
      addressLine2: String(form.get("addressLine2") || ""),
      city: String(form.get("city") || ""),
      state: String(form.get("state") || ""),
      postalCode: String(form.get("postalCode") || ""),
      referralCode: String(form.get("referralCode") || ""),
    };

    const response = await fetch("/api/waitlist/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json();

    if (!response.ok) {
      setStatus("error");
      setMessage(json.error || "Unable to join waitlist");
      return;
    }

    setStatus("success");
    setMessage("You are on the waitlist. We will reach out as soon as your zone activates.");
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <input
        name="fullName"
        required
        placeholder="Full name"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        name="phone"
        placeholder="Phone (optional)"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        name="referralCode"
        defaultValue={defaultReferral}
        placeholder="Referral code (optional)"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        name="addressLine1"
        required
        defaultValue={defaultAddressLine1}
        placeholder="Address line 1"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)] md:col-span-2"
      />
      <input
        name="addressLine2"
        placeholder="Address line 2 (optional)"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)] md:col-span-2"
      />
      <input
        name="city"
        required
        defaultValue={defaultCity}
        placeholder="City"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        name="state"
        required
        maxLength={2}
        defaultValue={defaultState}
        placeholder="State (TN)"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        name="postalCode"
        required
        defaultValue={defaultPostal}
        placeholder="Postal code"
        className="h-12 rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="h-12 rounded-xl bg-[var(--dc-orange)] px-6 font-bold text-white disabled:opacity-70"
      >
        {status === "sending" ? "Joining..." : "Join Waitlist"}
      </button>
      {message ? (
        <p
          className={`text-sm md:col-span-2 ${
            status === "error" ? "text-red-600" : "text-green-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
