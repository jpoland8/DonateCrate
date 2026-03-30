"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackMetaCustom } from "@/lib/meta-pixel";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";

type Prediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type ZoneStatus = {
  status: "active" | "pending" | "unserviceable";
  message: string;
  zone?: string | null;
  zoneName?: string | null;
  distanceMiles?: number | null;
};

function signUpWithGoogle() {
  const supabase = createClient();
  supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/app`,
    },
  });
}

export function SignupForm() {
  const searchParams = useSearchParams();

  /* ── Identity fields ── */
  const [email, setEmail] = useState(() => searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(() => searchParams.get("fullName") || "");
  const [phone, setPhone] = useState(() => searchParams.get("phone") || "");

  /* ── Address fields ── */
  const defaultAddressLine1 = useMemo(() => searchParams.get("addressLine1") || "", [searchParams]);
  const defaultCity = useMemo(() => searchParams.get("city") || "", [searchParams]);
  const defaultState = useMemo(() => searchParams.get("state") || "", [searchParams]);
  const defaultPostalCode = useMemo(() => searchParams.get("postalCode") || "", [searchParams]);
  const defaultReferralCode = useMemo(() => searchParams.get("ref") || "", [searchParams]);

  const [addressLine1, setAddressLine1] = useState(defaultAddressLine1);
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [stateValue, setStateValue] = useState(defaultState);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [referralCode, setReferralCode] = useState(defaultReferralCode);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  /* ── Google Places autocomplete ── */
  const [addressQuery, setAddressQuery] = useState(defaultAddressLine1);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(Boolean(defaultAddressLine1));

  /* ── Zone eligibility ── */
  const [zoneStatus, setZoneStatus] = useState<ZoneStatus | null>(null);
  const [zoneChecking, setZoneChecking] = useState(false);

  /* ── Form state ── */
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [inactiveAddress, setInactiveAddress] = useState<{
    reason?: string | null;
    zone?: string | null;
  } | null>(null);

  const hasPrefilledAddress = Boolean(defaultAddressLine1 && defaultPostalCode);

  /* ── Auto-check zone on prefilled address ── */
  useEffect(() => {
    if (hasPrefilledAddress && !zoneStatus) {
      checkZoneEligibility({
        addressLine1: defaultAddressLine1,
        city: defaultCity,
        state: defaultState,
        postalCode: defaultPostalCode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Autocomplete search (debounced) ── */
  useEffect(() => {
    const trimmed = addressQuery.trim();
    if (trimmed.length < 3 || addressConfirmed) {
      setPredictions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        const json = await response.json();
        if (response.ok && json.predictions) {
          setPredictions(json.predictions);
          setShowPredictions(true);
        }
      } catch {
        // Silently fail — user can still type manually
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [addressQuery, addressConfirmed]);

  async function selectPrediction(placeId: string) {
    setShowPredictions(false);
    setPredictions([]);

    try {
      const response = await fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const json = await response.json();
      if (!response.ok) return;

      setAddressLine1(json.addressLine1 || "");
      setCity(json.city || "");
      setStateValue(json.state || "");
      setPostalCode(json.postalCode || "");
      setLat(json.lat ?? null);
      setLng(json.lng ?? null);
      setAddressQuery(json.formattedAddress || json.addressLine1 || "");
      setAddressConfirmed(true);

      // Auto-check zone eligibility
      await checkZoneEligibility({
        addressLine1: json.addressLine1,
        city: json.city,
        state: json.state,
        postalCode: json.postalCode,
        lat: json.lat,
        lng: json.lng,
      });
    } catch {
      // Fail silently
    }
  }

  async function checkZoneEligibility(address: {
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    lat?: number | null;
    lng?: number | null;
  }) {
    setZoneChecking(true);
    setZoneStatus(null);
    try {
      const response = await fetch("/api/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressLine1: address.addressLine1,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          lat: address.lat ?? undefined,
          lng: address.lng ?? undefined,
        }),
      });
      const json = await response.json();
      if (response.ok) {
        setZoneStatus(json);
      }
    } catch {
      // Don't block signup on eligibility check failure
    } finally {
      setZoneChecking(false);
    }
  }

  function resetAddress() {
    setAddressConfirmed(false);
    setZoneStatus(null);
    setAddressLine1("");
    setCity("");
    setStateValue("");
    setPostalCode("");
    setLat(null);
    setLng(null);
    setAddressQuery("");
    setPredictions([]);
  }

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
      if (registerResponse.status === 409 && registerJson.error?.includes("already exists")) {
        setStatus("error");
        setMessage(registerJson.error || "An account already exists for this email.");
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
      waitlisted: Boolean(registerJson.isWaitlisted),
    });

    if (registerJson.isWaitlisted) {
      setMessage("Account created! Your area isn't active yet — we'll email you when service opens near you.");
      window.location.href = "/app";
    } else {
      setMessage(registerJson.warning ? `Account created. ${registerJson.warning}` : "Account created. Redirecting to billing...");
      window.location.href = "/app?onboarding=created";
    }
  }

  const isZoneActive = zoneStatus?.status === "active";
  const isZoneInactive = zoneStatus && zoneStatus.status !== "active";

  const currentStep = addressConfirmed ? 2 : 1;

  const steps = [
    { number: 1, label: "Address" },
    { number: 2, label: "Account" },
    { number: 3, label: "Plan" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Google sign-up ── */}
      <button
        type="button"
        onClick={signUpWithGoogle}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-black/[0.12] bg-white text-sm font-semibold text-[var(--dc-gray-800)] shadow-sm transition hover:border-black/20 hover:bg-[var(--dc-gray-50)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-black/[0.07]" />
        <span className="text-xs text-[var(--dc-gray-400)]">or sign up with email</span>
        <div className="h-px flex-1 bg-black/[0.07]" />
      </div>

      {/* ── Progress stepper ── */}
      <div className="flex items-center gap-0">
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          return (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ${
                    isCompleted
                      ? "bg-[var(--dc-gray-900)] text-white"
                      : isActive
                        ? "bg-[var(--dc-orange)] text-white shadow-[0_0_0_3px_var(--dc-orange)]/20"
                        : "border-2 border-black/20 bg-transparent text-[var(--dc-gray-400)]"
                  }`}
                >
                  {isCompleted ? (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M3 8.5l3.5 3.5 6.5-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isCompleted
                      ? "text-[var(--dc-gray-700)]"
                      : isActive
                        ? "text-[var(--dc-orange)]"
                        : "text-[var(--dc-gray-400)]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={`mx-2 mb-5 h-px flex-1 transition-all duration-200 ${
                    step.number < currentStep ? "bg-[var(--dc-gray-900)]" : "bg-black/15"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>

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

      {/* ── Address section with autocomplete ── */}
      <div className="rounded-[1.5rem] border border-black/10 bg-[var(--dc-gray-100)]/70 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Pickup Address</p>
        <p className="mt-2 text-sm text-[var(--dc-gray-700)]">
          Start typing to search for your address. We&apos;ll check if your area is eligible for pickup service.
        </p>
        <div className="relative mt-4">
          {addressConfirmed ? (
            /* ── Confirmed address display ── */
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-900">{addressLine1}</p>
                <p className="text-xs text-emerald-700">
                  {[city, stateValue, postalCode].filter(Boolean).join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={resetAddress}
                className="shrink-0 text-xs font-semibold text-emerald-700 underline hover:text-emerald-900"
              >
                Change
              </button>
            </div>
          ) : (
            /* ── Autocomplete search ── */
            <>
              <div className="relative">
                <input
                  type="text"
                  value={addressQuery}
                  onChange={(event) => {
                    setAddressQuery(event.target.value);
                    setAddressConfirmed(false);
                    setZoneStatus(null);
                  }}
                  onFocus={() => predictions.length > 0 && setShowPredictions(true)}
                  placeholder="Start typing your address..."
                  autoComplete="off"
                  className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4 pr-10"
                />
                {searching ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--dc-orange)] border-t-transparent" />
                  </div>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-gray-400)]" aria-hidden>
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Predictions dropdown */}
              {showPredictions && predictions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-black/10 bg-white shadow-lg">
                  {predictions.map((prediction) => (
                    <button
                      type="button"
                      key={prediction.placeId}
                      onClick={() => selectPrediction(prediction.placeId)}
                      className="block w-full px-4 py-3 text-left transition-colors hover:bg-[var(--dc-gray-50)]"
                    >
                      <p className="text-sm font-semibold text-[var(--dc-gray-900)]">{prediction.mainText}</p>
                      <p className="text-xs text-[var(--dc-gray-500)]">{prediction.secondaryText || prediction.description}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Manual entry fallback */}
              <button
                type="button"
                onClick={() => {
                  setShowPredictions(false);
                  setPredictions([]);
                  // Open manual fields
                  const manualSection = document.getElementById("manual-address-fields");
                  if (manualSection) manualSection.style.display = "block";
                }}
                className="mt-2 text-xs font-semibold text-[var(--dc-gray-500)] underline hover:text-[var(--dc-gray-700)]"
              >
                Enter address manually instead
              </button>
            </>
          )}
        </div>

        {/* Manual address fields (hidden by default, shown as fallback) */}
        {!addressConfirmed ? (
          <div id="manual-address-fields" className="mt-3 space-y-3" style={{ display: "none" }}>
            <input
              type="text"
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
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
                className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4"
              />
              <input
                type="text"
                maxLength={2}
                value={stateValue}
                onChange={(event) => setStateValue(event.target.value.toUpperCase())}
                placeholder="State"
                className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4"
              />
              <input
                type="text"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                placeholder="Postal code"
                className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (addressLine1 && city && stateValue && postalCode) {
                  setAddressConfirmed(true);
                  setAddressQuery(`${addressLine1}, ${city}, ${stateValue} ${postalCode}`);
                  checkZoneEligibility({ addressLine1, city, state: stateValue, postalCode });
                }
              }}
              className="text-sm font-semibold text-[var(--dc-orange)] underline hover:text-[#e55f00]"
            >
              Confirm this address
            </button>
          </div>
        ) : null}

        {/* Address line 2 when confirmed via autocomplete */}
        {addressConfirmed ? (
          <input
            type="text"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
            placeholder="Apartment, suite, unit (optional)"
            className="mt-3 h-12 w-full rounded-2xl border border-black/15 bg-white px-4"
          />
        ) : null}
      </div>

      {/* ── Zone eligibility status ── */}
      {zoneChecking ? (
        <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-[var(--dc-gray-50)] p-4">
          <Spinner size="md" color="orange" />
          <p className="text-sm text-[var(--dc-gray-600)]">Checking service eligibility for your address...</p>
        </div>
      ) : null}

      {isZoneActive ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Your address is in an active service area</p>
              <p className="mt-0.5 text-xs text-emerald-700">
                {zoneStatus.zoneName ? `Zone: ${zoneStatus.zoneName}` : zoneStatus.message}
                {zoneStatus.distanceMiles != null ? ` · ${zoneStatus.distanceMiles} mi from zone center` : ""}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isZoneInactive ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden>
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {zoneStatus.status === "pending" ? "Your area is planned but not active yet" : "This address is outside current service areas"}
              </p>
              <p className="mt-1 text-xs text-amber-800">{zoneStatus.message}</p>
              <p className="mt-2 text-xs text-amber-700">
                You can still create an account, or{" "}
                <Link href={waitlistHref} className="font-semibold underline">
                  join the waitlist
                </Link>{" "}
                to be notified when service opens in your area.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Referral code ── */}
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
        {referralCode.trim() ? (
          <p className="text-xs text-emerald-600 font-medium">
            Referral code will be applied to your account on signup.
          </p>
        ) : null}
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={status === "saving" || (!addressLine1 && !addressConfirmed)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--dc-orange)] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-150 hover:bg-[#e55f00] active:scale-[0.99]"
      >
        {status === "saving" ? <><Spinner size="sm" color="white" /> Creating...</> : "Create Account"}
      </button>

      {/* ── Non-active zone notice — informational, not blocking ── */}
      {isZoneInactive && zoneStatus ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            {zoneStatus.status === "pending"
              ? "Your area is planned but not active yet."
              : "Your address is outside current service areas."}
          </p>
          <p className="mt-1">
            You can still create an account — we&apos;ll notify you when service opens near you.
            Or{" "}
            <Link href={waitlistHref} className="font-semibold underline">
              join the waitlist only
            </Link>
            {" "}if you prefer not to create an account.
          </p>
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
    </div>
  );
}
