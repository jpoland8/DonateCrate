import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const bodySchema = z.object({
  name: z.string().min(2),
  amountCents: z.number().int().positive(),
  currency: z.string().default("usd"),
  stripePriceId: z.string().min(3),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { supabase } = ctx;
  await supabase.from("pricing_plans").update({ active: false }).eq("active", true);

  const { data, error } = await supabase
    .from("pricing_plans")
    .insert({
      name: parsed.data.name,
      amount_cents: parsed.data.amountCents,
      currency: parsed.data.currency,
      stripe_price_id: parsed.data.stripePriceId,
      active: true,
    })
    .select("id,name,amount_cents,currency,stripe_price_id,active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pricingPlan: data });
}
