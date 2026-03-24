import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeAppPath } from "@/lib/redirects";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");
  let destination = getSafeAppPath(next, "/app");

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type === "recovery") {
    const recoveryUrl = new URL("/reset-password", url.origin);
    recoveryUrl.searchParams.set("token_hash", tokenHash);
    return NextResponse.redirect(recoveryUrl);
  } else if (tokenHash && type === "magiclink") {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
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

  const redirectResponse = NextResponse.redirect(new URL(destination, url.origin));
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}
