"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getDefaultHomePath } from "@/lib/access";
import { getHighestPartnerRole } from "@/lib/partner-access";
import { getSafeAppPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const requestedNextPath = useMemo(() => searchParams.get("next"), [searchParams]);
  const safeNextPath = useMemo(() => getSafeAppPath(requestedNextPath, "/app"), [requestedNextPath]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic_link">("password");
  const [status, setStatus] = useState<"idle" | "sending" | "sending_reset" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendPasswordReset() {
    if (!email.trim()) {
      setStatus("error");
      setMessage("Enter your email first, then use forgot password.");
      return;
    }

    setStatus("sending_reset");
    setMessage("");
    const response = await fetch("/api/auth/send-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(json.error || "Unable to send a password reset right now.");
      return;
    }

    setStatus("sent");
    setMessage(json.message || "Password reset email sent. Check your inbox for the recovery link.");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const supabase = createClient();
    let error: Error | null = null;
    if (mode === "password") {
      const result = await supabase.auth.signInWithPassword({ email, password });
      error = result.error;
      if (!error) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: profile } = await supabase
            .from("users")
            .select("id,role")
            .eq("auth_user_id", user.id)
            .maybeSingle();

          const { data: memberships } = profile?.id
            ? await supabase.from("partner_memberships").select("role").eq("user_id", profile.id).eq("active", true)
            : { data: [] as Array<{ role: string }> };

          const roleHome = getDefaultHomePath(profile?.role, {
            hasActivePartnerMembership: Boolean(getHighestPartnerRole((memberships ?? []).map((membership) => membership.role))),
          });
          const destination = requestedNextPath && safeNextPath !== "/app" ? safeNextPath : roleHome;
          window.location.href = destination;
          return;
        }
        window.location.href = requestedNextPath && safeNextPath !== "/app" ? safeNextPath : "/app";
        return;
      }
    } else {
      const response = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: safeNextPath }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        error = new Error(json.error || "Unable to send a sign-in link right now.");
      } else {
        setStatus("sent");
        setMessage(json.message || "Magic link sent. Check your inbox.");
        return;
      }
    }

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage(mode === "magic_link" ? "Magic link sent. Check your inbox." : "Signed in.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Heading */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--dc-orange)]">Sign In</p>
        <h2 className="mt-1.5 text-2xl font-bold text-[var(--dc-gray-900)] sm:text-3xl">Access your account</h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--dc-gray-600)]">
          Password or magic link — team members are routed to the right workspace.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex rounded-full border border-black/[0.07] bg-[var(--dc-gray-100)] p-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${
            mode === "password"
              ? "bg-[var(--dc-orange)] text-white shadow-sm"
              : "text-[var(--dc-gray-600)] hover:text-[var(--dc-gray-900)]"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic_link")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${
            mode === "magic_link"
              ? "bg-[var(--dc-orange)] text-white shadow-sm"
              : "text-[var(--dc-gray-600)] hover:text-[var(--dc-gray-900)]"
          }`}
        >
          Magic Link
        </button>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="text-sm font-semibold text-[var(--dc-gray-700)]">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="dc-input w-full"
        />
      </div>

      {/* Password */}
      {mode === "password" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-semibold text-[var(--dc-gray-700)]">
              Password
            </label>
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={status === "sending" || status === "sending_reset"}
              className="text-xs font-semibold text-[var(--dc-orange)] transition hover:text-[var(--dc-orange-strong)] disabled:opacity-60"
            >
              {status === "sending_reset" ? "Sending…" : "Forgot password?"}
            </button>
          </div>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="dc-input w-full"
          />
        </div>
      ) : (
        <p className="rounded-xl border border-black/[0.07] bg-[var(--dc-gray-50)] px-4 py-3 text-sm leading-6 text-[var(--dc-gray-600)]">
          We&apos;ll email you a one-click sign-in link — no password needed.
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "sending" || status === "sending_reset"}
        className="dc-btn-primary h-12 w-full text-base"
      >
        {status === "sending" || status === "sending_reset"
          ? "Working…"
          : mode === "password"
            ? "Sign In"
            : "Send Magic Link"}
      </button>

      {/* Sign up link */}
      <p className="text-sm text-[var(--dc-gray-600)]">
        New here?{" "}
        <Link
          href={requestedNextPath ? `/signup?next=${encodeURIComponent(safeNextPath)}` : "/signup"}
          className="font-semibold text-[var(--dc-gray-900)] underline underline-offset-2 hover:text-[var(--dc-orange)]"
        >
          Create an account
        </Link>
      </p>

      {/* Status message */}
      {message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
            status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
