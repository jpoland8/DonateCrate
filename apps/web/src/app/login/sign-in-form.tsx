"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
            .select("role")
            .eq("auth_user_id", user.id)
            .maybeSingle();

          const roleHome = profile?.role === "admin" || profile?.role === "driver" ? "/admin" : "/app";
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
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="inline-flex rounded-full bg-[var(--dc-gray-100)] p-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "password" ? "bg-black text-white shadow-sm" : "text-black"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic_link")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "magic_link" ? "bg-black text-white shadow-sm" : "text-black"
          }`}
        >
          Magic Link
        </button>
      </div>
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
          className="h-12 w-full rounded-2xl border border-black/15 px-4 outline-none transition focus:border-[var(--dc-orange)]"
        />
      </div>
      {mode === "password" ? (
        <div className="space-y-1.5">
          <label htmlFor="login-password" className="text-sm font-semibold text-[var(--dc-gray-700)]">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-12 w-full rounded-2xl border border-black/15 px-4 outline-none transition focus:border-[var(--dc-orange)]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={status === "sending" || status === "sending_reset"}
              className="text-sm font-semibold text-[var(--dc-orange)] transition hover:text-[var(--dc-orange-strong)] disabled:opacity-60"
            >
              {status === "sending_reset" ? "Sending reset..." : "Forgot password?"}
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending" || status === "sending_reset"}
        className="h-12 w-full rounded-2xl bg-[var(--dc-orange)] font-semibold text-white transition hover:bg-[var(--dc-orange-strong)] disabled:opacity-60"
      >
        {status === "sending" || status === "sending_reset"
          ? "Working..."
          : mode === "password"
            ? "Sign In"
            : "Send Magic Link"}
      </button>
      <p className="text-sm text-[var(--dc-gray-700)]">
        New here?{" "}
        <Link href={requestedNextPath ? `/signup?next=${encodeURIComponent(safeNextPath)}` : "/signup"} className="font-semibold text-black underline">
          Create an account
        </Link>
      </p>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}
