"use client";

import { FormEvent, useState } from "react";

export function PartnerSetupForm({ tokenHash }: { tokenHash: string | null }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!tokenHash) {
      setStatus("error");
      setMessage("This setup link is incomplete. Ask for a new invite.");
      return;
    }

    if (password.length < 8) {
      setStatus("error");
      setMessage("Use at least 8 characters for your password.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match yet.");
      return;
    }

    setStatus("saving");
    const response = await fetch("/api/auth/complete-partner-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenHash,
        fullName,
        phone,
        password,
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(json.error || "We could not complete setup right now.");
      return;
    }

    setStatus("saved");
    setMessage(json.message || "Account setup complete. Redirecting to sign in.");
    window.setTimeout(() => {
      window.location.href = "/login?partner_setup=success&next=/partner";
    }, 1200);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-[1.5rem] border border-black/10 bg-[var(--dc-gray-100)]/65 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Profile</p>
        <div className="mt-3 grid gap-3">
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
            className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4 outline-none focus:border-[var(--dc-orange)]"
          />
          <input
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone number"
            className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4 outline-none focus:border-[var(--dc-orange)]"
          />
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-black/10 bg-[var(--dc-gray-100)]/65 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Password</p>
        <div className="mt-3 grid gap-3">
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create password"
            className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4 outline-none focus:border-[var(--dc-orange)]"
          />
          <input
            required
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            className="h-12 w-full rounded-2xl border border-black/15 bg-white px-4 outline-none focus:border-[var(--dc-orange)]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 w-full rounded-2xl bg-[var(--dc-orange)] font-bold text-white disabled:opacity-70"
      >
        {status === "saving" ? "Saving..." : "Complete Team Setup"}
      </button>

      <p className="text-sm text-[var(--dc-gray-700)]">
        This setup link is for first-time organization access. After setup, sign in with your password to open the partner portal.
      </p>

      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}
