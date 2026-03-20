import { NextResponse } from "next/server";
import { getSafeAppPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  let destination = getSafeAppPath(next, "/app");

  const supabase = await createClient();
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  if (destination === "/app") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      destination = profile?.role === "admin" || profile?.role === "driver" ? "/admin" : "/app";
    } else {
      destination = "/app";
    }
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
