"use client";

import { useState } from "react";

type OnboardingFormProps = {
  defaultEmail: string;
  defaultFullName?: string;
  defaultPhone?: string;
  defaultAddressLine1?: string;
  defaultAddressLine2?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultPostalCode?: string;
  returnPath?: string;
  submitLabel?: string;
};

export function OnboardingForm({
  defaultEmail,
  defaultFullName = "",
  defaultPhone = "",
  defaultAddressLine1 = "",
  defaultAddressLine2 = "",
  defaultCity = "",
  defaultState = "",
  defaultPostalCode = "",
  returnPath = "/app",
  submitLabel = "Continue",
}: OnboardingFormProps) {
  const [fullName, setFullName] = useState(defaultFullName);
  const [phone, setPhone] = useState(defaultPhone);
  const [addressLine1, setAddressLine1] = useState(defaultAddressLine1);
  const [addressLine2, setAddressLine2] = useState(defaultAddressLine2);
  const [city, setCity] = useState(defaultCity);
  const [stateValue, setStateValue] = useState(defaultState);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state: stateValue,
        postalCode,
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setStatus("error");
      setMessage(json.error || "Could not save profile");
      return;
    }

    window.location.href = returnPath;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        value={defaultEmail}
        disabled
        className="h-12 w-full rounded-xl border border-black/10 bg-[var(--dc-gray-100)] px-4 text-[var(--dc-gray-700)]"
      />
      <input
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="Full name"
        className="h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Phone"
        className="h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <p className="text-xs text-[var(--dc-gray-700)]">
        Use the phone number where you want pickup reminders and any route exception updates.
      </p>
      <input
        required
        value={addressLine1}
        onChange={(event) => setAddressLine1(event.target.value)}
        placeholder="Address line 1"
        className="h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <input
        value={addressLine2}
        onChange={(event) => setAddressLine2(event.target.value)}
        placeholder="Address line 2 (optional)"
        className="h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)]"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input
          required
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="City"
          className="h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)] md:col-span-1"
        />
        <input
          required
          maxLength={2}
          value={stateValue}
          onChange={(event) => setStateValue(event.target.value.toUpperCase())}
          placeholder="State"
          className="h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)] md:col-span-1"
        />
        <input
          required
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
          placeholder="Postal code"
          className="h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--dc-orange)] md:col-span-1"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 w-full rounded-xl bg-[var(--dc-orange)] font-bold text-white disabled:opacity-70"
      >
        {status === "saving" ? "Saving..." : submitLabel}
      </button>
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
    </form>
  );
}
