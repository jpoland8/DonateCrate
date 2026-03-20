"use client";

import { type FormEvent, useEffect, useState } from "react";

type Props = {
  apiBaseUrl: string;
};

export function WaitlistFormIsland({ apiBaseUrl }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [signupUrl, setSignupUrl] = useState("");
  const [defaults, setDefaults] = useState({
    referralCode: "",
    fullName: "",
    email: "",
    phone: "",
    addressLine1: "",
    city: "",
    state: "TN",
    postalCode: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDefaults({
      referralCode: params.get("ref") || "",
      fullName: params.get("fullName") || "",
      email: params.get("email") || "",
      phone: params.get("phone") || "",
      addressLine1: params.get("addressLine1") || "",
      city: params.get("city") || "",
      state: params.get("state") || "TN",
      postalCode: params.get("postalCode") || "",
    });
  }, []);

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

    try {
      const response = await fetch(`${apiBaseUrl}/api/waitlist/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(json.message || json.error || "Unable to join the waitlist.");
        setSignupUrl(typeof json.signupUrl === "string" ? json.signupUrl : "");
        return;
      }

      setStatus("success");
      setMessage(json.message || "You are on the waitlist.");
      setSignupUrl("");
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage(String(error));
    }
  }

  return (
    <form className="waitlist-form" onSubmit={onSubmit}>
      <input name="fullName" required defaultValue={defaults.fullName} placeholder="Full name" />
      <input name="email" type="email" required defaultValue={defaults.email} placeholder="Email" />
      <input name="phone" defaultValue={defaults.phone} placeholder="Phone (optional)" />
      <input name="referralCode" defaultValue={defaults.referralCode} placeholder="Referral code (optional)" />
      <input
        name="addressLine1"
        required
        defaultValue={defaults.addressLine1}
        placeholder="Address line 1"
        className="waitlist-form__full"
      />
      <input name="addressLine2" placeholder="Address line 2 (optional)" className="waitlist-form__full" />
      <input name="city" required defaultValue={defaults.city} placeholder="City" />
      <input name="state" required maxLength={2} defaultValue={defaults.state} placeholder="State" />
      <input name="postalCode" required defaultValue={defaults.postalCode} placeholder="Postal code" />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Joining..." : "Join Waitlist"}
      </button>
      {message ? <p className={`waitlist-form__message waitlist-form__message--${status}`}>{message}</p> : null}
      {status === "error" && signupUrl ? (
        <p className="waitlist-form__message">
          <a href={signupUrl} style={{ fontWeight: 700, textDecoration: "underline" }}>
            Continue to signup instead
          </a>
        </p>
      ) : null}
    </form>
  );
}
