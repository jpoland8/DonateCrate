import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { adminLimiter } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: referrals, error }, { data: credits }] = await Promise.all([
    ctx.supabase
      .from("referrals")
      .select("id,referrer_user_id,referred_user_id,referral_code,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    ctx.supabase
      .from("credits_ledger")
      .select("user_id,source,amount_cents,created_at")
      .in("source", ["referral_bonus_referrer", "referral_bonus_referred"])
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = Array.from(
    new Set(
      (referrals ?? [])
        .flatMap((row) => [row.referrer_user_id, row.referred_user_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: users } =
    userIds.length > 0
      ? await ctx.supabase.from("users").select("id,email").in("id", userIds)
      : { data: [] as Array<{ id: string; email: string }> };

  const emailById = new Map((users ?? []).map((u) => [u.id, u.email]));

  return NextResponse.json({
    referrals: (referrals ?? []).map((row) => ({
      ...row,
      referrer_email: emailById.get(row.referrer_user_id) ?? null,
      referred_email: row.referred_user_id ? (emailById.get(row.referred_user_id) ?? null) : null,
    })),
    credits: credits ?? [],
  });
}

