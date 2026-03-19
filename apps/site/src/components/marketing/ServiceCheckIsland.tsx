"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

type Prediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type SelectedAddress = {
  placeId: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
};

type EligibilityResponse = {
  status: "active" | "pending" | "unserviceable";
  message: string;
  zone?: string | null;
  zoneName?: string | null;
  distanceMiles?: number | null;
};

type Props = {
  apiBaseUrl: string;
  accountBaseUrl: string;
};

export function ServiceCheckIsland({ apiBaseUrl, accountBaseUrl }: Props) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const [result, setResult] = useState<EligibilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSearch = useMemo(() => Boolean(selected?.placeId && selected.addressLine1 && selected.postalCode), [selected]);

  async function checkEligibility(address: SelectedAddress) {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/eligibility/check`, {
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
      if (!response.ok) {
        setError(json.error || "Eligibility check failed.");
        return;
      }
      setResult(json);
    } catch (fetchError) {
      setError(String(fetchError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setPredictions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/places/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        const json = await response.json();
        if (!response.ok) {
          setPredictions([]);
          setError(json.error || "Address search is unavailable right now.");
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
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [apiBaseUrl, query]);

  async function selectPrediction(placeId: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/places/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json.error || "Could not load address details.");
        return;
      }
      setSelected(json);
      setQuery(json.formattedAddress);
      setPredictions([]);
      await checkEligibility(json);
    } catch (fetchError) {
      setError(String(fetchError));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError("Choose an address from the suggestion list first.");
      return;
    }

    await checkEligibility(selected);
  }

  const signupHref = `${accountBaseUrl}/signup?addressLine1=${encodeURIComponent(
    selected?.addressLine1 || "",
  )}&city=${encodeURIComponent(selected?.city || "")}&state=${encodeURIComponent(
    selected?.state || "",
  )}&postalCode=${encodeURIComponent(selected?.postalCode || "")}&source=eligibility`;
  const loginHref = `${accountBaseUrl}/login?next=/app`;
  const waitlistHref = `/waitlist?postalCode=${encodeURIComponent(
    selected?.postalCode || "",
  )}&addressLine1=${encodeURIComponent(selected?.addressLine1 || "")}&city=${encodeURIComponent(
    selected?.city || "",
  )}&state=${encodeURIComponent(selected?.state || "")}`;

  return (
    <div className="service-check">
      <div className="service-check__intro">
        <span className="eyebrow">Service Check</span>
        <h2>See whether DonateCrate is available at your home.</h2>
        <p>
          Start with your street address. As soon as you choose a match, we will tell you whether you can sign up now
          or join the waitlist for your neighborhood.
        </p>
      </div>

      <form className="service-check__form" onSubmit={onSubmit}>
        <label htmlFor="service-check-address" className="sr-only">
          Street address
        </label>
        <input
          id="service-check-address"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setResult(null);
          }}
          placeholder="Search your address"
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !canSearch}>
          {loading ? "Checking..." : result ? "Check Again" : "Check Availability"}
        </button>
      </form>

      {searching ? <p className="service-check__status">Finding matching addresses...</p> : null}

      {predictions.length > 0 ? (
        <div className="service-check__predictions">
          {predictions.map((prediction) => (
            <button key={prediction.placeId} type="button" onClick={() => selectPrediction(prediction.placeId)}>
              <strong>{prediction.mainText}</strong>
              <span>{prediction.secondaryText || prediction.description}</span>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <p className="service-check__status">
          {loading ? "Checking service at:" : "Selected address:"} {selected.formattedAddress}
        </p>
      ) : null}

      {result ? (
        <div className={`service-check__result service-check__result--${result.status}`}>
          <span className="service-check__pill">{result.status === "active" ? "Open for signup" : result.status}</span>
          <h3>{result.message}</h3>
          <div className="service-check__meta">
            {result.zoneName ? <span>Service area: {result.zoneName}</span> : null}
            {result.distanceMiles != null ? <span>{result.distanceMiles} miles from current pickup coverage</span> : null}
          </div>

          {result.status === "active" ? (
            <div className="service-check__actions">
              <a href={signupHref}>Create my account</a>
              <a href={loginHref} className="service-check__link">
                I already have an account
              </a>
            </div>
          ) : (
            <div className="service-check__actions">
              <a href={waitlistHref}>Join the waitlist</a>
              <p>We will save your address details so joining later is easier when your area opens up.</p>
            </div>
          )}
        </div>
      ) : null}

      {error ? <div className="service-check__error">{error}</div> : null}
    </div>
  );
}
