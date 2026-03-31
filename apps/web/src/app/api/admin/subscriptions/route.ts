import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { adminLimiter } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  subscriptionId: z.string().uuid(),
  action: z.enum(["sync", "schedule_cancel", "resume", "cancel_now"]),
});

type StripeSubscriptionRow = {
  id: string;
  user_id?: string;
  pricing_plan_id?: string | null;
  status: string;
  updated_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  users: {
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  pricing_plans:
    | {
        name: string;
        amount_cents: number;
        currency: string;
        stripe_price_id: string | null;
      }
    | null
    | Array<{
        name: string;
        amount_cents: number;
        currency: string;
        stripe_price_id: string | null;
      }>;
};

type SubscriptionViewModel = {
  id: string;
  status: string;
  updatedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  latestInvoiceStatus: string | null;
  paymentMethodSummary: string | null;
  paymentMethod: {
    type: string | null;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    funding: string | null;
    country: string | null;
  } | null;
  latestInvoice: {
    status: string | null;
    amountDueCents: number | null;
    amountPaidCents: number | null;
    currency: string | null;
    hostedInvoiceUrl: string | null;
  } | null;
  plan: {
    name: string | null;
    amountCents: number | null;
    currency: string;
    stripePriceId: string | null;
  };
  user: {
    email: string;
    fullName: string | null;
    phone: string | null;
  };
};

function getStripeClient() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || stripeSecretKey === "placeholder") return null;

  return new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 20000,
  });
}

function normalizeSubscriptionStatus(subscription: Stripe.Subscription) {
  if (subscription.pause_collection) return "paused";

  switch (subscription.status) {
    case "trialing":
    case "active":
    case "past_due":
    case "paused":
      return subscription.status;
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "unpaid":
    case "incomplete":
      return "past_due";
    default:
      return "active";
  }
}

function isoFromStripeTimestamp(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function getPlanMeta(row: StripeSubscriptionRow) {
  const plan = Array.isArray(row.pricing_plans) ? row.pricing_plans[0] : row.pricing_plans;
  return {
    name: plan?.name ?? null,
    amountCents: plan?.amount_cents ?? null,
    currency: plan?.currency ?? "usd",
    stripePriceId: plan?.stripe_price_id ?? null,
  };
}

function getPaymentMethodSummary(paymentMethod: Stripe.Subscription["default_payment_method"]) {
  if (!paymentMethod || typeof paymentMethod === "string") return null;
  if (paymentMethod.type !== "card" || !paymentMethod.card) return paymentMethod.type;
  return `${paymentMethod.card.brand} ending in ${paymentMethod.card.last4}`;
}

function getPaymentMethodDetails(paymentMethod: Stripe.Subscription["default_payment_method"]) {
  if (!paymentMethod || typeof paymentMethod === "string") return null;
  if (paymentMethod.type !== "card" || !paymentMethod.card) {
    return {
      type: paymentMethod.type,
      brand: null,
      last4: null,
      expMonth: null,
      expYear: null,
      funding: null,
      country: null,
    };
  }

  return {
    type: paymentMethod.type,
    brand: paymentMethod.card.brand ?? null,
    last4: paymentMethod.card.last4 ?? null,
    expMonth: paymentMethod.card.exp_month ?? null,
    expYear: paymentMethod.card.exp_year ?? null,
    funding: paymentMethod.card.funding ?? null,
    country: paymentMethod.card.country ?? null,
  };
}

function getLatestInvoiceDetails(latestInvoice: Stripe.Subscription["latest_invoice"]) {
  if (!latestInvoice || typeof latestInvoice === "string") return null;
  return {
    status: latestInvoice.status ?? null,
    amountDueCents: latestInvoice.amount_due ?? null,
    amountPaidCents: latestInvoice.amount_paid ?? null,
    currency: latestInvoice.currency ?? null,
    hostedInvoiceUrl: latestInvoice.hosted_invoice_url ?? null,
  };
}

async function getRestartPaymentMethodId(stripe: Stripe, customerId: string) {
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted && customer.invoice_settings.default_payment_method) {
    return typeof customer.invoice_settings.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method.id;
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  const paymentMethodId = paymentMethods.data[0]?.id ?? null;
  if (!paymentMethodId) return null;

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  return paymentMethodId;
}

async function syncSubscriptionRowFromStripe(args: {
  stripe: Stripe;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  row: StripeSubscriptionRow;
}): Promise<SubscriptionViewModel> {
  const { stripe, supabase, row } = args;

  if (!row.stripe_subscription_id) {
    return {
      id: row.id,
      status: row.status,
      updatedAt: row.updated_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      latestInvoiceStatus: null,
      paymentMethodSummary: null,
      paymentMethod: null,
      latestInvoice: null,
      plan: getPlanMeta(row),
      user: {
        email: row.users?.email ?? "Unknown",
        fullName: row.users?.full_name ?? null,
        phone: row.users?.phone ?? null,
      },
    };
  }

  try {
    const stripeSubscription = (await stripe.subscriptions.retrieve(row.stripe_subscription_id, {
      expand: ["default_payment_method", "latest_invoice"],
    })) as Stripe.Subscription;

    const normalizedStatus = normalizeSubscriptionStatus(stripeSubscription);
    const primaryItem = stripeSubscription.items.data[0];
    const currentPeriodStart = isoFromStripeTimestamp(primaryItem?.current_period_start);
    const currentPeriodEnd = isoFromStripeTimestamp(primaryItem?.current_period_end);

    await supabase
      .from("subscriptions")
      .update({
        status: normalizedStatus,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    const latestInvoice =
      stripeSubscription.latest_invoice && typeof stripeSubscription.latest_invoice !== "string"
        ? stripeSubscription.latest_invoice
        : null;

    return {
      id: row.id,
      status: normalizedStatus,
      updatedAt: new Date().toISOString(),
      currentPeriodStart,
      currentPeriodEnd,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: isoFromStripeTimestamp(stripeSubscription.canceled_at),
      latestInvoiceStatus: latestInvoice?.status ?? null,
      paymentMethodSummary: getPaymentMethodSummary(stripeSubscription.default_payment_method),
      paymentMethod: getPaymentMethodDetails(stripeSubscription.default_payment_method),
      latestInvoice: getLatestInvoiceDetails(stripeSubscription.latest_invoice),
      plan: getPlanMeta(row),
      user: {
        email: row.users?.email ?? "Unknown",
        fullName: row.users?.full_name ?? null,
        phone: row.users?.phone ?? null,
      },
    };
  } catch (error) {
    return {
      id: row.id,
      status: row.status,
      updatedAt: row.updated_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      latestInvoiceStatus: `Stripe sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      paymentMethodSummary: null,
      paymentMethod: null,
      latestInvoice: null,
      plan: getPlanMeta(row),
      user: {
        email: row.users?.email ?? "Unknown",
        fullName: row.users?.full_name ?? null,
        phone: row.users?.phone ?? null,
      },
    };
  }
}

export async function GET(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id,user_id,pricing_plan_id,status,updated_at,current_period_start,current_period_end,stripe_customer_id,stripe_subscription_id,users(email,full_name,phone),pricing_plans(name,amount_cents,currency,stripe_price_id)",
    )
    .order("updated_at", { ascending: false })
    .limit(150);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({
      subscriptions: (data ?? []).map((row) => {
        const typedRow = row as unknown as StripeSubscriptionRow;
        return {
          id: typedRow.id,
          status: typedRow.status,
          updatedAt: typedRow.updated_at,
          currentPeriodStart: typedRow.current_period_start,
          currentPeriodEnd: typedRow.current_period_end,
          stripeCustomerId: typedRow.stripe_customer_id,
          stripeSubscriptionId: typedRow.stripe_subscription_id,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          latestInvoiceStatus: null,
          paymentMethodSummary: null,
          paymentMethod: null,
          latestInvoice: null,
          plan: getPlanMeta(typedRow),
          user: {
            email: typedRow.users?.email ?? "Unknown",
            fullName: typedRow.users?.full_name ?? null,
            phone: typedRow.users?.phone ?? null,
          },
        };
      }),
    });
  }

  const enriched = await Promise.all(
    (data ?? []).map((row) =>
      syncSubscriptionRowFromStripe({
        stripe,
        supabase: supabaseAdmin,
        row: row as unknown as StripeSubscriptionRow,
      }),
    ),
  );

  return NextResponse.json({ subscriptions: enriched });
}

export async function PATCH(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const stripe = getStripeClient();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: subscriptionRow, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id,user_id,pricing_plan_id,status,updated_at,current_period_start,current_period_end,stripe_customer_id,stripe_subscription_id,users(email,full_name,phone),pricing_plans(name,amount_cents,currency,stripe_price_id)",
    )
    .eq("id", parsed.data.subscriptionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subscriptionRow) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

  const row = subscriptionRow as unknown as StripeSubscriptionRow;
  if (!row.stripe_subscription_id) {
    return NextResponse.json({ error: "This account does not have a Stripe subscription yet" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "schedule_cancel") {
      await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
    }
    if (parsed.data.action === "resume" && row.status !== "canceled") {
      await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: false });
    }
    if (parsed.data.action === "resume" && row.status === "canceled") {
      const plan = getPlanMeta(row);
      if (!row.stripe_customer_id) {
        return NextResponse.json({ error: "This canceled subscription is missing a Stripe customer" }, { status: 400 });
      }
      if (!plan.stripePriceId) {
        return NextResponse.json({ error: "This canceled subscription is not linked to a Stripe price" }, { status: 400 });
      }
      const defaultPaymentMethodId = await getRestartPaymentMethodId(stripe, row.stripe_customer_id);
      if (!defaultPaymentMethodId) {
        return NextResponse.json(
          { error: "This customer does not have a reusable default payment method on file in Stripe" },
          { status: 400 },
        );
      }

      const restarted = await stripe.subscriptions.create({
        customer: row.stripe_customer_id,
        items: [{ price: plan.stripePriceId }],
        collection_method: "charge_automatically",
        default_payment_method: defaultPaymentMethodId,
      });

      const restartStatus = normalizeSubscriptionStatus(restarted);
      const { error: restartUpdateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          stripe_subscription_id: restarted.id,
          status: restartStatus,
          current_period_start: isoFromStripeTimestamp(restarted.items.data[0]?.current_period_start),
          current_period_end: isoFromStripeTimestamp(restarted.items.data[0]?.current_period_end),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (restartUpdateError) {
        return NextResponse.json({ error: restartUpdateError.message }, { status: 500 });
      }

      const { data: persistedRow, error: persistedRowError } = await supabaseAdmin
        .from("subscriptions")
        .select(
          "id,user_id,pricing_plan_id,status,updated_at,current_period_start,current_period_end,stripe_customer_id,stripe_subscription_id,users(email,full_name,phone),pricing_plans(name,amount_cents,currency,stripe_price_id)",
        )
        .eq("id", row.id)
        .maybeSingle();
      if (persistedRowError) {
        return NextResponse.json({ error: persistedRowError.message }, { status: 500 });
      }
      if (!persistedRow) {
        return NextResponse.json({ error: "Updated subscription record could not be reloaded" }, { status: 500 });
      }

      const updated = await syncSubscriptionRowFromStripe({
        stripe,
        supabase: supabaseAdmin,
        row: persistedRow as unknown as StripeSubscriptionRow,
      });
      return NextResponse.json({ ok: true, subscription: updated, restarted: true });
    }
    if (parsed.data.action === "cancel_now") {
      await stripe.subscriptions.cancel(row.stripe_subscription_id);
    }

    const updated = await syncSubscriptionRowFromStripe({ stripe, supabase: supabaseAdmin, row });
    return NextResponse.json({ ok: true, subscription: updated });
  } catch (stripeError) {
    const message = stripeError instanceof Error ? stripeError.message : "Stripe action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
