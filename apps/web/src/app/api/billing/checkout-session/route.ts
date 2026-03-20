import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || stripeSecretKey === "placeholder") {
    return NextResponse.json({ error: "Stripe secret key is not configured" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 20000,
  });
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: activePlan, error: planError } = await supabaseAdmin
    .from("pricing_plans")
    .select("id,name,currency,stripe_price_id,amount_cents")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError || !activePlan) {
    return NextResponse.json({ error: planError?.message ?? "No active pricing plan found" }, { status: 404 });
  }

  // Ensure the active plan has a valid Stripe recurring price in sandbox/prod.
  let stripePriceId = activePlan.stripe_price_id;
  if (stripePriceId) {
    try {
      await stripe.prices.retrieve(stripePriceId);
    } catch {
      stripePriceId = null;
    }
  }
  if (!stripePriceId) {
    const product = await stripe.products.create({
      name: activePlan.name || "DonateCrate Monthly Plan",
      metadata: { pricing_plan_id: activePlan.id },
    });
    const createdPrice = await stripe.prices.create({
      unit_amount: activePlan.amount_cents,
      currency: (activePlan.currency || "usd").toLowerCase(),
      recurring: { interval: "month" },
      product: product.id,
      metadata: { pricing_plan_id: activePlan.id },
    });
    stripePriceId = createdPrice.id;
    await supabaseAdmin
      .from("pricing_plans")
      .update({ stripe_price_id: stripePriceId })
      .eq("id", activePlan.id);
  }

  const { data: existingSubscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id,stripe_customer_id,stripe_subscription_id,status")
    .eq("user_id", ctx.profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let stripeCustomerId = existingSubscription?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: ctx.profile.email,
      metadata: {
        app_user_id: ctx.profile.id,
      },
    });
    stripeCustomerId = customer.id;
  }

  const hasExistingStripeSub =
    Boolean(existingSubscription?.stripe_subscription_id) &&
    ["active", "past_due", "paused"].includes(existingSubscription?.status || "");
  if (hasExistingStripeSub) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const billingPortal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/app`,
    });
    return NextResponse.json({ ok: true, url: billingPortal.url });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/app?checkout=canceled`,
    metadata: {
      app_user_id: ctx.profile.id,
      pricing_plan_id: activePlan.id,
    },
  });

  if (existingSubscription?.id) {
    await supabaseAdmin
      .from("subscriptions")
      .update({
        pricing_plan_id: activePlan.id,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSubscription.id);
  }

  return NextResponse.json({ ok: true, url: checkoutSession.url });
}
