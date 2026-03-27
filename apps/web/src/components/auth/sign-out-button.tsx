"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dc-orange)] ${
        tone === "dark"
          ? "border-white/25 text-white/80 hover:bg-white hover:text-black"
          : "border-black/12 text-[var(--dc-gray-600)] hover:bg-[var(--dc-gray-900)] hover:text-white hover:border-[var(--dc-gray-900)]"
      }`}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
        <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3M11 11l3-3-3-3M14 8H6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
