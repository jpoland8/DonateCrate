import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { apiLimiter } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || stripeSecretKey === "placeholder") {
    return NextResponse.json({ error: "Billing not configured" }, { status: 500 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id,stripe_subscription_id,status")
    .eq("user_id", ctx.profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  if (subscription.status === "canceled") {
    return NextResponse.json({ error: "Subscription is already canceled" }, { status: 409 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 20000,
  });

  const canceled = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const cancelAt = canceled.cancel_at
    ? new Date(canceled.cancel_at * 1000).toISOString()
    : null;

  await supabase
    .from("subscriptions")
    .update({
      status: "canceling",
      cancel_at: cancelAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  return NextResponse.json({ ok: true, cancelAt });
}
