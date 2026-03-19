"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const defaultAddressLine1 = useMemo(() => searchParams.get("addressLine1") || "", [searchParams]);
  const defaultCity = useMemo(() => searchParams.get("city") || "", [searchParams]);
  const defaultState = useMemo(() => searchParams.get("state") || "TN", [searchParams]);
  const defaultPostalCode = useMemo(() => searchParams.get("postalCode") || "37922", [searchParams]);
  const [addressLine1, setAddressLine1] = useState(defaultAddressLine1);
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [stateValue, setStateValue] = useState(defaultState);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

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
      }),
    });
    const registerJson = await registerResponse.json().catch(() => ({}));

    if (!registerResponse.ok) {
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
    setMessage("Account created. Redirecting to billing...");
    window.location.href = "/app?onboarding=created";
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="text"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="Full name"
        className="h-12 w-full rounded-xl border border-black/20 px-4"
      />
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="h-12 w-full rounded-xl border border-black/20 px-4"
      />
      <input
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Create a password (min 8 chars)"
        className="h-12 w-full rounded-xl border border-black/20 px-4"
      />
      <input
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Phone number"
        className="h-12 w-full rounded-xl border border-black/20 px-4"
      />
      <input
        type="text"
        required
        value={addressLine1}
        onChange={(event) => setAddressLine1(event.target.value)}
        placeholder="Address line 1"
        className="h-12 w-full rounded-xl border border-black/20 px-4"
      />
      <input
        type="text"
        value={addressLine2}
        onChange={(event) => setAddressLine2(event.target.value)}
        placeholder="Address line 2 (optional)"
        className="h-12 w-full rounded-xl border border-black/20 px-4"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input
          type="text"
          required
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="City"
          className="h-12 w-full rounded-xl border border-black/20 px-4 md:col-span-1"
        />
        <input
          type="text"
          required
          maxLength={2}
          value={stateValue}
          onChange={(event) => setStateValue(event.target.value.toUpperCase())}
          placeholder="State"
          className="h-12 w-full rounded-xl border border-black/20 px-4 md:col-span-1"
        />
        <input
          type="text"
          required
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
          placeholder="Postal code"
          className="h-12 w-full rounded-xl border border-black/20 px-4 md:col-span-1"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 w-full rounded-xl bg-[var(--dc-orange)] font-semibold text-white disabled:opacity-70"
      >
        {status === "saving" ? "Creating..." : "Create Account"}
      </button>
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
