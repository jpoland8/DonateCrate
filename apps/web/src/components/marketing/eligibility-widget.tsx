"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type EligibilityResponse = {
  status: "active" | "pending" | "unserviceable";
  message: string;
  zone?: string | null;
  zoneName?: string | null;
  distanceMiles?: number | null;
};

export function EligibilityWidget() {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<
    Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>
  >([]);
  const [selected, setSelected] = useState<{
    placeId: string;
    formattedAddress: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    lat: number | null;
    lng: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<EligibilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSearch = useMemo(() => selected?.placeId && selected.addressLine1 && selected.postalCode, [selected]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
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
        if (!response.ok) {
          setPredictions([]);
          setError(json.error || "Address search unavailable");
          return;
        }
        setError(null);
        setPredictions(json.predictions ?? []);
      } catch (fetchError) {
        setPredictions([]);
        setError(String(fetchError));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  async function selectPrediction(placeId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Could not load address details");
        return;
      }
      setSelected(json);
      setQuery(json.formattedAddress);
      setPredictions([]);
    } catch (fetchError) {
      setError(String(fetchError));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError("Select an address from suggestions first.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressLine1: selected.addressLine1,
          city: selected.city,
          state: selected.state,
          postalCode: selected.postalCode,
          lat: selected.lat ?? undefined,
          lng: selected.lng ?? undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Eligibility check failed");
      } else {
        setResult(json);
      }
    } catch (fetchError) {
      setError(String(fetchError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={onSubmit}
        className="mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl bg-white/95 p-4 text-black shadow-xl md:flex-row"
      >
        <label htmlFor="address-search" className="sr-only">
          Enter address
        </label>
        <input
          id="address-search"
          name="addressSearch"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setResult(null);
          }}
          placeholder="Start typing your address"
          autoComplete="off"
          className="h-12 flex-1 rounded-xl border border-black/20 px-4 outline-none transition focus:border-[var(--dc-orange)]"
        />
        <button
          type="submit"
          disabled={loading || !canSearch}
          className="h-12 rounded-xl bg-black px-8 font-bold text-white transition hover:bg-[var(--dc-orange)] disabled:opacity-70"
        >
          {loading ? "Checking..." : "Search"}
        </button>
      </form>
      {searching ? <p className="max-w-2xl text-xs text-white/80">Searching addresses...</p> : null}
      {predictions.length > 0 ? (
        <div className="max-h-72 max-w-2xl overflow-auto rounded-xl border border-white/20 bg-black/70 p-2">
          {predictions.map((prediction) => (
            <button
              type="button"
              key={prediction.placeId}
              onClick={() => selectPrediction(prediction.placeId)}
              className="block w-full rounded-lg px-3 py-2 text-left text-white hover:bg-white/10"
            >
              <p className="text-sm font-semibold">{prediction.mainText}</p>
              <p className="text-xs text-white/70">{prediction.secondaryText || prediction.description}</p>
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <p className="max-w-2xl text-xs text-white/80">
          Checking radius eligibility for: {selected.formattedAddress}
        </p>
      ) : null}

      {result ? (
        <div className="max-w-2xl rounded-xl border border-white/20 bg-black/30 p-4 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">{result.status}</p>
          <p className="mt-2 text-lg">{result.message}</p>
          {result.zoneName ? <p className="mt-1 text-sm text-white/80">Zone: {result.zoneName}</p> : null}
          {result.distanceMiles != null ? (
            <p className="mt-1 text-sm text-white/80">Distance to zone center: {result.distanceMiles} miles</p>
          ) : null}
          {result.status !== "active" ? (
            <Link
              href={`/waitlist?postalCode=${encodeURIComponent(selected?.postalCode || "")}&addressLine1=${encodeURIComponent(
                selected?.addressLine1 || "",
              )}&city=${encodeURIComponent(selected?.city || "")}&state=${encodeURIComponent(selected?.state || "")}`}
              className="mt-3 inline-block rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-bold text-white"
            >
              Join Waitlist
            </Link>
          ) : (
            <Link
              href="/login?next=/app"
              className="mt-3 inline-block rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-bold text-white"
            >
              Continue to Signup
            </Link>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="max-w-2xl rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
