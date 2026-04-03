import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { apiLimiter } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/urls";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  try {
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
    let stripeSubscriptionId = existingSubscription?.stripe_subscription_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: ctx.profile.email,
        metadata: {
          app_user_id: ctx.profile.id,
        },
      });
      stripeCustomerId = customer.id;
    }
    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch {
        stripeCustomerId = null;
      }
    }
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: ctx.profile.email,
        metadata: {
          app_user_id: ctx.profile.id,
        },
      });
      stripeCustomerId = customer.id;
      if (existingSubscription?.id) {
        await supabaseAdmin
          .from("subscriptions")
          .update({
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSubscription.id);
      }
      stripeSubscriptionId = null;
    }

    const hasExistingStripeSub =
      Boolean(stripeSubscriptionId) &&
      ["active", "past_due", "paused"].includes(existingSubscription?.status || "");
    const appUrl = getAppUrl();

    if (hasExistingStripeSub) {
      try {
        const billingPortal = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${appUrl}/app`,
        });
        return NextResponse.json({ ok: true, url: billingPortal.url });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to open Stripe billing portal";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    // Check if this user was referred — give them a free first month via Stripe trial
    const { data: qualifiedReferral } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", ctx.profile.id)
      .eq("status", "qualified")
      .maybeSingle();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      subscription_data: qualifiedReferral ? { trial_period_days: 30 } : undefined,
      success_url: `${appUrl}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app?checkout=canceled`,
      metadata: {
        app_user_id: ctx.profile.id,
        pricing_plan_id: activePlan.id,
        has_referral_trial: qualifiedReferral ? "true" : "false",
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Stripe checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
