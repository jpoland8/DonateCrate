import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";

export async function POST() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "dc_test_bypass",
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

