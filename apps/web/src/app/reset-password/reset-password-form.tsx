"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setStatus("error");
      setMessage("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match yet.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("saved");
    setMessage("Password updated. Taking you back to your account.");
    window.setTimeout(() => {
      window.location.href = "/app";
    }, 1200);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="reset-password" className="text-sm font-semibold text-[var(--dc-gray-700)]">
          New password
        </label>
        <input
          id="reset-password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a new password"
          className="h-12 w-full rounded-2xl border border-black/15 px-4 outline-none transition focus:border-[var(--dc-orange)]"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reset-password-confirm" className="text-sm font-semibold text-[var(--dc-gray-700)]">
          Confirm password
        </label>
        <input
          id="reset-password-confirm"
          type="password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter your new password"
          className="h-12 w-full rounded-2xl border border-black/15 px-4 outline-none transition focus:border-[var(--dc-orange)]"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 w-full rounded-2xl bg-[var(--dc-orange)] font-semibold text-white transition hover:bg-[var(--dc-orange-strong)] disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Update Password"}
      </button>
      <p className="text-sm text-[var(--dc-gray-700)]">
        This link is only for password recovery. Once your password is saved, we will send you back into the app.
      </p>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}
