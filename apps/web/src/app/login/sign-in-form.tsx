"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const requestedNextPath = useMemo(() => searchParams.get("next"), [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic_link">("password");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

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
        if (requestedNextPath) {
          window.location.href = requestedNextPath;
          return;
        }

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
          window.location.href = roleHome;
          return;
        }
        window.location.href = "/app";
        return;
      }
    } else {
      const nextPath = requestedNextPath || "/home";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const result = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      error = result.error;
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "password" ? "bg-black text-white" : "bg-[var(--dc-gray-100)] text-black"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic_link")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "magic_link" ? "bg-black text-white" : "bg-[var(--dc-gray-100)] text-black"
          }`}
        >
          Magic Link
        </button>
      </div>
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="h-12 w-full rounded-xl border border-black/20 px-4 outline-none transition focus:border-[var(--dc-orange)]"
      />
      {mode === "password" ? (
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="h-12 w-full rounded-xl border border-black/20 px-4 outline-none transition focus:border-[var(--dc-orange)]"
        />
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="h-12 w-full rounded-xl bg-[var(--dc-orange)] font-semibold text-white transition hover:bg-[var(--dc-orange-strong)] disabled:opacity-60"
      >
        {status === "sending"
          ? "Working..."
          : mode === "password"
            ? "Sign In"
            : "Send Magic Link"}
      </button>
      <p className="text-sm text-[var(--dc-gray-700)]">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-black underline">
          Create an account
        </Link>
      </p>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p>
      ) : null}
    </form>
  );
}
