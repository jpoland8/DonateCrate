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

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(safeNextPath)}`,
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="text-[1.85rem] font-bold leading-tight tracking-tight text-[var(--dc-gray-900)]">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-[var(--dc-gray-500)]">
          Sign in to your DonateCrate account
        </p>
      </div>

      {/* Google sign-in */}
      <button
        type="button"
        onClick={signInWithGoogle}
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

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-black/[0.07]" />
        <span className="text-xs text-[var(--dc-gray-400)]">or</span>
        <div className="h-px flex-1 bg-black/[0.07]" />
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl border border-black/[0.08] bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 ${
            mode === "password"
              ? "bg-[var(--dc-orange)] text-white shadow-sm"
              : "text-[var(--dc-gray-500)] hover:text-[var(--dc-gray-800)]"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic_link")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-150 ${
            mode === "magic_link"
              ? "bg-[var(--dc-orange)] text-white shadow-sm"
              : "text-[var(--dc-gray-500)] hover:text-[var(--dc-gray-800)]"
          }`}
        >
          Magic Link
        </button>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--dc-gray-500)]">
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

      {/* Password or magic link hint */}
      {mode === "password" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--dc-gray-500)]">
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
        <div className="flex items-start gap-3 rounded-xl border border-black/[0.07] bg-white px-4 py-3.5 shadow-sm">
          <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-orange)]">
            <path d="M3 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="m2 6 8 6 8-6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p className="text-sm leading-6 text-[var(--dc-gray-600)]">
            We&apos;ll send a one-click sign-in link — no password needed.
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === "sending" || status === "sending_reset"}
        className="relative h-12 w-full overflow-hidden rounded-xl bg-[var(--dc-orange)] text-base font-semibold text-white shadow-[0_4px_16px_rgba(255,106,0,0.30)] transition hover:bg-[var(--dc-orange-strong)] hover:shadow-[0_4px_20px_rgba(255,106,0,0.40)] disabled:opacity-60"
      >
        {status === "sending" || status === "sending_reset"
          ? "Working…"
          : mode === "password"
            ? "Sign In"
            : "Send Magic Link"}
      </button>

      <Link
        href={requestedNextPath ? `/signup?next=${encodeURIComponent(safeNextPath)}` : "/signup"}
        className="flex h-11 w-full items-center justify-center rounded-xl border border-black/[0.09] bg-white text-sm font-semibold text-[var(--dc-gray-700)] shadow-sm transition hover:border-[var(--dc-orange)] hover:text-[var(--dc-orange)]"
      >
        Create an account
      </Link>

      {/* Status message */}
      {message ? (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-6 ${
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
