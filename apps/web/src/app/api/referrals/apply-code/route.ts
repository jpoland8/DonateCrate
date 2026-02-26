import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { normalizeCode } from "@/lib/referrals";

const bodySchema = z.object({
  referralCode: z.string().min(4),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { supabase } = ctx;
  const code = normalizeCode(parsed.data.referralCode);
  if (code.length < 4) return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });

  const { data: affiliate, error: affiliateError } = await supabase
    .from("affiliate_codes")
    .select("user_id,code")
    .eq("code", code)
    .maybeSingle();
  if (affiliateError || !affiliate) {
    return NextResponse.json({ error: "Referral code not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      error:
        "Referral codes can only be used by new users during signup/waitlist entry. Signed-in account holders cannot apply codes.",
    },
    { status: 409 },
  );
}
