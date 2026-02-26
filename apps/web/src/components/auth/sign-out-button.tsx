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
      className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
        tone === "dark"
          ? "border-white/35 text-white hover:bg-white hover:text-black"
          : "border-black text-black hover:bg-black hover:text-white"
      }`}
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
