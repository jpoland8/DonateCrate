import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  subscriptionId: z.string().uuid(),
  action: z.enum(["sync", "schedule_cancel", "resume", "cancel_now"]),
});

type StripeSubscriptionRow = {
  id: string;
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
      }
    | null
    | Array<{
        name: string;
        amount_cents: number;
        currency: string;
      }>;
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
  };
}

function getPaymentMethodSummary(paymentMethod: Stripe.Subscription["default_payment_method"]) {
  if (!paymentMethod || typeof paymentMethod === "string") return null;
  if (paymentMethod.type !== "card" || !paymentMethod.card) return paymentMethod.type;
  return `${paymentMethod.card.brand} ending in ${paymentMethod.card.last4}`;
}

async function syncSubscriptionRowFromStripe(args: {
  stripe: Stripe;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  row: StripeSubscriptionRow;
}) {
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
      plan: getPlanMeta(row),
      user: {
        email: row.users?.email ?? "Unknown",
        fullName: row.users?.full_name ?? null,
        phone: row.users?.phone ?? null,
      },
    };
  }
}

export async function GET() {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id,status,updated_at,current_period_start,current_period_end,stripe_customer_id,stripe_subscription_id,users(email,full_name,phone),pricing_plans(name,amount_cents,currency)",
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
      "id,status,updated_at,current_period_start,current_period_end,stripe_customer_id,stripe_subscription_id,users(email,full_name,phone),pricing_plans(name,amount_cents,currency)",
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
    if (parsed.data.action === "resume") {
      await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: false });
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
