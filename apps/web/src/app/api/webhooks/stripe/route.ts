import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createCorrelationId } from "@/lib/api-auth";
import { creditQualifiedReferralIfEligible } from "@/lib/referrals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function handleCheckoutCompleted(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  session: Stripe.Checkout.Session;
}) {
  const { supabase, session } = params;
  const appUserId = session.metadata?.app_user_id;
  const pricingPlanId = session.metadata?.pricing_plan_id;
  if (!appUserId) return;

  await supabase
    .from("subscriptions")
    .update({
      pricing_plan_id: pricingPlanId ?? null,
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", appUserId)
    .eq("stripe_customer_id", String(session.customer));

  await creditQualifiedReferralIfEligible({ supabase, referredUserId: appUserId });
}

async function handleSubscriptionStatusEvent(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  event: Stripe.Event;
  correlationId: string;
}) {
  const { supabase, event, correlationId } = params;
  const object = event.data.object as Stripe.Invoice | Stripe.Subscription;
  const subscriptionId =
    "subscription" in object
      ? (typeof object.subscription === "string" ? object.subscription : null)
      : object.id;

  if (!subscriptionId) return;

  const status =
    event.type === "invoice.payment_failed"
      ? "past_due"
      : event.type === "invoice.paid"
        ? "active"
        : "status" in object
          ? object.status
          : "active";

  const normalizedStatus = ["trialing", "active", "past_due", "paused", "canceled"].includes(String(status))
    ? status
    : "active";

  await supabase
    .from("subscriptions")
    .update({
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  const { data: subscriptionRow } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if ((normalizedStatus === "active" || normalizedStatus === "trialing") && subscriptionRow?.user_id) {
    await creditQualifiedReferralIfEligible({ supabase, referredUserId: subscriptionRow.user_id });
  }

  if (event.type === "invoice.payment_failed" && subscriptionRow?.user_id) {
    const hostedInvoiceUrl =
      "hosted_invoice_url" in object && typeof object.hosted_invoice_url === "string" ? object.hosted_invoice_url : null;
    await supabase.from("notification_events").insert({
      user_id: subscriptionRow.user_id,
      channel: "email",
      event_type: "billing_payment_failed",
      status: "queued",
      correlation_id: correlationId,
      metadata: {
        stripe_event_type: event.type,
        stripe_subscription_id: subscriptionId,
        invoice_url: hostedInvoiceUrl,
      },
    });
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId("stripe");
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || stripeSecretKey === "placeholder") {
    return NextResponse.json({ error: "Stripe secret key is not configured", correlationId }, { status: 500 });
  }
  if (!webhookSecret || webhookSecret === "placeholder") {
    return NextResponse.json({ error: "Stripe webhook secret is not configured", correlationId }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 20000,
  });
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe signature", correlationId }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: `Invalid signature: ${String(error)}`, correlationId }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingEvent } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existingEvent) {
    return NextResponse.json({ ok: true, deduped: true, correlationId });
  }

  const storeResult = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    correlation_id: correlationId,
    payload: event as unknown as Record<string, unknown>,
  });
  if (storeResult.error) {
    return NextResponse.json({ error: storeResult.error.message, correlationId }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted({
          supabase,
          session: event.data.object as Stripe.Checkout.Session,
        });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed":
      case "customer.subscription.updated": {
        await handleSubscriptionStatusEvent({ supabase, event, correlationId });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    await supabase
      .from("stripe_webhook_events")
      .update({
        processing_state: "failed",
        processing_error: String(error),
        handled_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ error: `Handler failed: ${String(error)}`, correlationId }, { status: 500 });
  }

  await supabase
    .from("stripe_webhook_events")
    .update({
      processing_state: "processed",
      processing_error: null,
      handled_at: new Date().toISOString(),
    })
    .eq("stripe_event_id", event.id);

  return NextResponse.json({ ok: true, correlationId });
}
