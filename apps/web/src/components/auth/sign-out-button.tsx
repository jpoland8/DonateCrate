"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  tone = "light",
  collapsed = false,
}: {
  tone?: "light" | "dark";
  collapsed?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const icon = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (collapsed) {
    return (
      <button
        onClick={onClick}
        disabled={loading}
        title="Sign out"
        aria-label="Sign out"
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-150 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dc-orange)] ${
          tone === "dark"
            ? "border-white/20 text-white/60 hover:bg-white/10 hover:text-white"
            : "border-black/10 text-[var(--dc-gray-500)] hover:bg-[var(--dc-gray-900)] hover:text-white hover:border-[var(--dc-gray-900)]"
        }`}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dc-orange)] ${
        tone === "dark"
          ? "border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
          : "border-black/10 text-[var(--dc-gray-600)] hover:bg-[var(--dc-gray-900)] hover:text-white hover:border-[var(--dc-gray-900)]"
      }`}
    >
      {icon}
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
