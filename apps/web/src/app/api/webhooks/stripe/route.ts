import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createCorrelationId } from "@/lib/api-auth";
import { createAndProcessNotificationEmail } from "@/lib/notification-jobs";
import { creditQualifiedReferralIfEligible } from "@/lib/referrals";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function handleCheckoutCompleted(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  correlationId: string;
}) {
  const { supabase, stripe, session, correlationId } = params;
  const appUserId = session.metadata?.app_user_id;
  const pricingPlanId = session.metadata?.pricing_plan_id;
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (!appUserId || !stripeCustomerId || !stripeSubscriptionId) return;

  const updateResult = await supabase
    .from("subscriptions")
    .update({
      pricing_plan_id: pricingPlanId ?? null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", appUserId)
    .select("id")
    .limit(1);

  if ((updateResult.data?.length ?? 0) === 0) {
    await supabase.from("subscriptions").insert({
      user_id: appUserId,
      pricing_plan_id: pricingPlanId ?? null,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      status: "active",
    });
  }

  // Credit the referral (idempotent — only runs once, only after first payment)
  const creditResult = await creditQualifiedReferralIfEligible({ supabase, referredUserId: appUserId });

  if (creditResult.credited) {
    // Referred user already gets a free first month via the Stripe trial applied at checkout.
    // Only apply the Stripe balance credit to the referrer here.
    if (creditResult.referrerUserId) {
      const { data: referrerSub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", creditResult.referrerUserId)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (referrerSub?.stripe_customer_id) {
        try {
          await stripe.customers.createBalanceTransaction(referrerSub.stripe_customer_id, {
            amount: -500,
            currency: "usd",
            description: "Referral reward — $5 off your next month for referring a new subscriber",
          });
        } catch (err) {
          console.error("Failed to apply Stripe balance to referrer", err);
        }
      }
    }
  }

  await createAndProcessNotificationEmail({
    supabase,
    userId: appUserId,
    eventType: "billing_plan_active",
    correlationId,
    metadata: {
      plan_name: "DonateCrate monthly pickup plan",
      status_label: "Active",
      dashboard_path: "/app",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      pricing_plan_id: pricingPlanId ?? null,
    },
  });
}

async function handleSubscriptionStatusEvent(params: {
  stripe: Stripe;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  event: Stripe.Event;
  correlationId: string;
}) {
  const { stripe, supabase, event, correlationId } = params;
  const object = event.data.object as Stripe.Invoice | Stripe.Subscription | Stripe.InvoicePayment;
  let subscriptionId: string | null = null;

  if (object.object === "invoice") {
    const invoiceSubscription = (object as Stripe.Invoice & { subscription?: string | { id?: string } | null }).subscription;
    subscriptionId =
      typeof invoiceSubscription === "string" ? invoiceSubscription : invoiceSubscription?.id ?? null;
  } else if (object.object === "invoice_payment") {
    const invoiceId = typeof object.invoice === "string" ? object.invoice : object.invoice?.id ?? null;
    if (invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const invoiceSubscription = (invoice as Stripe.Invoice & { subscription?: string | { id?: string } | null }).subscription;
      subscriptionId =
        typeof invoiceSubscription === "string" ? invoiceSubscription : invoiceSubscription?.id ?? null;
    }
  } else if (object.object === "subscription") {
    subscriptionId = object.id;
  }

  if (!subscriptionId) return;

  const status =
    event.type === "invoice.payment_failed"
      ? "past_due"
      : event.type === "invoice.paid" || event.type === "invoice.payment_succeeded" || event.type === "invoice_payment.paid"
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

  if (normalizedStatus === "active" && subscriptionRow?.user_id) {
    await creditQualifiedReferralIfEligible({ supabase, referredUserId: subscriptionRow.user_id });
  }

  if (event.type === "invoice.payment_failed" && subscriptionRow?.user_id) {
    const hostedInvoiceUrl =
      "hosted_invoice_url" in object && typeof object.hosted_invoice_url === "string" ? object.hosted_invoice_url : null;
    await createAndProcessNotificationEmail({
      supabase,
      userId: subscriptionRow.user_id,
      eventType: "billing_payment_failed",
      correlationId,
      metadata: {
        stripe_event_type: event.type,
        stripe_subscription_id: subscriptionId,
        invoice_url: hostedInvoiceUrl,
        plan_name: "DonateCrate monthly pickup plan",
      },
    });
  }

  if (event.type === "customer.subscription.updated" && normalizedStatus === "canceled" && subscriptionRow?.user_id) {
    await createAndProcessNotificationEmail({
      supabase,
      userId: subscriptionRow.user_id,
      eventType: "billing_subscription_canceled",
      correlationId,
      metadata: {
        stripe_event_type: event.type,
        stripe_subscription_id: subscriptionId,
        plan_name: "DonateCrate monthly pickup plan",
        status_label: "Canceled",
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
          stripe,
          session: event.data.object as Stripe.Checkout.Session,
          correlationId,
        });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
      case "invoice_payment.paid":
      case "customer.subscription.updated": {
        await handleSubscriptionStatusEvent({ stripe, supabase, event, correlationId });
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
