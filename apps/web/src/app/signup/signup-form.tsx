"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackMetaCustom } from "@/lib/meta-pixel";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(() => searchParams.get("fullName") || "");
  const [phone, setPhone] = useState(() => searchParams.get("phone") || "");
  const defaultAddressLine1 = useMemo(() => searchParams.get("addressLine1") || "", [searchParams]);
  const defaultCity = useMemo(() => searchParams.get("city") || "", [searchParams]);
  const defaultState = useMemo(() => searchParams.get("state") || "TN", [searchParams]);
  const defaultPostalCode = useMemo(() => searchParams.get("postalCode") || "37922", [searchParams]);
  const defaultReferralCode = useMemo(() => searchParams.get("ref") || "", [searchParams]);
  const [addressLine1, setAddressLine1] = useState(defaultAddressLine1);
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [stateValue, setStateValue] = useState(defaultState);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [referralCode, setReferralCode] = useState(defaultReferralCode);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [inactiveAddress, setInactiveAddress] = useState<{
    reason?: string | null;
    zone?: string | null;
  } | null>(null);

  const waitlistHref = useMemo(() => {
    const params = new URLSearchParams({
      postalCode,
      addressLine1,
      city,
      state: stateValue,
      fullName,
      email,
    });
    if (phone.trim()) params.set("phone", phone.trim());
    if (referralCode.trim()) params.set("ref", referralCode.trim());
    return `/waitlist?${params.toString()}`;
  }, [addressLine1, city, email, fullName, phone, postalCode, referralCode, stateValue]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    setInactiveAddress(null);

    const registerResponse = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state: stateValue,
        postalCode,
        referralCode: referralCode.trim() || undefined,
      }),
    });
    const registerJson = await registerResponse.json().catch(() => ({}));

    if (!registerResponse.ok) {
      if (registerResponse.status === 409 && registerJson.reason) {
        setInactiveAddress({
          reason: registerJson.reason || null,
          zone: registerJson.zone || null,
        });
        setStatus("error");
        setMessage("This address is not active for signup yet.");
        return;
      }
      setStatus("error");
      setMessage(registerJson.error || "Could not create account");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    trackMetaCustom("AccountCreated", {
      postal_code: postalCode,
      state: stateValue,
      has_referral: Boolean(referralCode.trim()),
    });
    setMessage(registerJson.warning ? `Account created. ${registerJson.warning}` : "Account created. Redirecting to billing...");
    window.location.href = "/app?onboarding=created";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="signup-full-name" className="text-sm font-semibold text-[var(--dc-gray-700)]">
            Full name
          </label>
          <input
            id="signup-full-name"
            type="text"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            className="h-12 w-full rounded-2xl border border-black/15 px-4"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="text-sm font-semibold text-[var(--dc-gray-700)]">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-12 w-full rounded-2xl border border-black/15 px-4"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="signup-phone" className="text-sm font-semibold text-[var(--dc-gray-700)]">
            Phone
          </label>
          <input
            id="signup-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone number"
            className="h-12 w-full rounded-2xl border border-black/15 px-4"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor="signup-password" className="text-sm font-semibold text-[var(--dc-gray-700)]">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password (min 8 chars)"
            className="h-12 w-full rounded-2xl border border-black/15 px-4"
          />
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-black/10 bg-[var(--dc-gray-100)]/70 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Pickup Address</p>
        <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
          This is the address we verify for service eligibility, route planning, and pickup reminders.
        </p>
        <div className="mt-4 space-y-3">
          <input
            type="text"
            required
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
            placeholder="Address line 1"
            className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4"
          />
          <input
            type="text"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
            placeholder="Address line 2 (optional)"
            className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4"
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <input
          type="text"
          required
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="City"
          className="h-12 w-full rounded-2xl border border-black/15 px-4 md:col-span-1"
        />
        <input
          type="text"
          required
          maxLength={2}
          value={stateValue}
          onChange={(event) => setStateValue(event.target.value.toUpperCase())}
          placeholder="State"
          className="h-12 w-full rounded-2xl border border-black/15 px-4 md:col-span-1"
        />
        <input
          type="text"
          required
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
          placeholder="Postal code"
          className="h-12 w-full rounded-2xl border border-black/15 px-4 md:col-span-1"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="signup-referral" className="text-sm font-semibold text-[var(--dc-gray-700)]">
          Referral code
        </label>
        <input
          id="signup-referral"
          type="text"
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
          placeholder="Referral code (optional)"
          className="h-12 w-full rounded-2xl border border-black/15 px-4"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 w-full rounded-2xl bg-[var(--dc-orange)] font-semibold text-white disabled:opacity-70"
      >
        {status === "saving" ? "Creating..." : "Create Account"}
      </button>
      {inactiveAddress ? (
        <div className="rounded-[1.5rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">This address is not in an active pickup zone yet.</p>
          <p className="mt-1">
            {inactiveAddress.reason ? `${inactiveAddress.reason}. ` : ""}
            We can save your details on the waitlist instead and notify you when this area opens.
          </p>
          <div className="mt-3">
            <Link href={waitlistHref} className="font-semibold underline">
              Continue to the waitlist
            </Link>
          </div>
        </div>
      ) : null}
      <p className="text-sm text-[var(--dc-gray-700)]">
        Already have an account?{" "}
        <Link href="/login?next=/app" className="font-semibold text-black underline">
          Sign in
        </Link>
      </p>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}
