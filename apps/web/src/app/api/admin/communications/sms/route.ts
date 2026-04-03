import { NextResponse } from "next/server";
import { z } from "zod";
import { createCorrelationId } from "@/lib/api-auth";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { getTwilioConfigError, normalizeToE164US, sendTwilioSms } from "@/lib/twilio";

const sendSmsSchema = z.object({
  targetType: z.enum(["individual", "zone", "all"]),
  message: z.string().trim().min(1).max(600),
  userIds: z.array(z.string().uuid()).optional(),
  zoneId: z.string().uuid().optional(),
  includeStaff: z.boolean().optional(),
});

type Recipient = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  phoneRaw: string;
  phoneE164: string;
};

type RecipientTargetInput = {
  targetType: "individual" | "zone" | "all";
  userIds?: string[];
  zoneId?: string;
  includeStaff?: boolean;
};


async function resolveRecipientCandidates(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthenticatedContext>>>,
  input: RecipientTargetInput,
) {
  let candidateUsers: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    phone: string | null;
  }> = [];
  const includeStaff = input.includeStaff === true;

  if (input.targetType === "individual") {
    const userIds = input.userIds ?? [];
    if (userIds.length === 0) {
      return { error: "Choose at least one recipient", recipients: [] as Recipient[] };
    }
    const { data, error } = await ctx.supabase
      .from("users")
      .select("id,email,full_name,role,phone")
      .in("id", userIds);
    if (error) return { error: error.message, recipients: [] as Recipient[] };
    candidateUsers = data ?? [];

    const deduped = new Map<string, Recipient>();
    for (const user of candidateUsers) {
      const phoneE164 = normalizeToE164US(user.phone);
      if (!phoneE164) continue;

      if (!deduped.has(phoneE164)) {
        deduped.set(phoneE164, {
          userId: user.id,
          email: user.email ?? "",
          fullName: user.full_name ?? "",
          role: user.role,
          phoneRaw: user.phone ?? "",
          phoneE164,
        });
      }
    }

    return { error: null, recipients: Array.from(deduped.values()) };
  } else if (input.targetType === "zone") {
    const zoneId = input.zoneId;
    if (!zoneId) return { error: "Select a zone", recipients: [] as Recipient[] };

    const { data: memberships, error: membershipError } = await ctx.supabase
      .from("zone_memberships")
      .select("user_id,status")
      .eq("zone_id", zoneId)
      .eq("status", "active");
    if (membershipError) return { error: membershipError.message, recipients: [] as Recipient[] };

    const zoneUserIds = [...new Set((memberships ?? []).map((m) => m.user_id).filter(Boolean))];
    if (zoneUserIds.length === 0) {
      return { error: null, recipients: [] as Recipient[] };
    }

    const { data, error } = await ctx.supabase
      .from("users")
      .select("id,email,full_name,role,phone")
      .in("id", zoneUserIds)
      .eq("role", "customer");
    if (error) return { error: error.message, recipients: [] as Recipient[] };
    candidateUsers = data ?? [];
  } else {
    let query = ctx.supabase.from("users").select("id,email,full_name,role,phone");
    if (!includeStaff) query = query.eq("role", "customer");
    const { data, error } = await query;
    if (error) return { error: error.message, recipients: [] as Recipient[] };
    candidateUsers = data ?? [];
  }

  const candidateIds = candidateUsers.map((u) => u.id);
  if (candidateIds.length === 0) return { error: null, recipients: [] as Recipient[] };

  const { data: preferences, error: prefsError } = await ctx.supabase
    .from("notification_preferences")
    .select("user_id,sms_enabled")
    .in("user_id", candidateIds);

  if (prefsError) return { error: prefsError.message, recipients: [] as Recipient[] };

  const smsPreference = new Map((preferences ?? []).map((p) => [p.user_id, p.sms_enabled]));

  const deduped = new Map<string, Recipient>();
  for (const user of candidateUsers) {
    const phoneE164 = normalizeToE164US(user.phone);
    if (!phoneE164) continue;

    const smsEnabled = smsPreference.has(user.id) ? smsPreference.get(user.id) === true : true;
    if (!smsEnabled) continue;

    if (user.role !== "customer" && !includeStaff) continue;

    if (!deduped.has(phoneE164)) {
      deduped.set(phoneE164, {
        userId: user.id,
        email: user.email ?? "",
        fullName: user.full_name ?? "",
        role: user.role,
        phoneRaw: user.phone ?? "",
        phoneE164,
      });
    }
  }

  return { error: null, recipients: Array.from(deduped.values()) };
}

export async function GET(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const targetTypeParam = searchParams.get("targetType");
  const targetType = targetTypeParam === "zone" || targetTypeParam === "all" || targetTypeParam === "individual"
    ? targetTypeParam
    : "zone";
  const zoneId = searchParams.get("zoneId") ?? undefined;
  const includeStaff = searchParams.get("includeStaff") === "true";
  const userIdsRaw = searchParams.get("userIds");
  const userIds = userIdsRaw
    ? userIdsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const resolved = await resolveRecipientCandidates(ctx, { targetType, zoneId, includeStaff, userIds });
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });

  return NextResponse.json({
    twilioReady: !getTwilioConfigError(),
    twilioConfigError: getTwilioConfigError(),
    eligibleUsers: resolved.recipients.map((r) => ({
      id: r.userId,
      email: r.email,
      fullName: r.fullName,
      role: r.role,
      phone: r.phoneRaw,
    })),
    count: resolved.recipients.length,
  });
}

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const correlationId = createCorrelationId("sms");

  const twilioConfigError = getTwilioConfigError();
  if (twilioConfigError) {
    return NextResponse.json({ error: twilioConfigError, correlationId }, { status: 500 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = sendSmsSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", correlationId }, { status: 400 });

  const { targetType, message, includeStaff = false } = parsed.data;
  const resolved = await resolveRecipientCandidates(ctx, {
    targetType,
    userIds: parsed.data.userIds,
    zoneId: parsed.data.zoneId,
    includeStaff,
  });
  if (resolved.error) return NextResponse.json({ error: resolved.error, correlationId }, { status: 400 });
  const recipients = resolved.recipients;

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No eligible recipients found (valid phone).", correlationId },
      { status: 400 },
    );
  }

  const results: Array<{ userId: string; status: "sent" | "failed"; providerMessageId: string | null; error: string | null }> = [];
  for (const recipient of recipients) {
    try {
      const twilio = await sendTwilioSms({ to: recipient.phoneE164, body: message });
      results.push({ userId: recipient.userId, status: "sent", providerMessageId: twilio.sid, error: null });
    } catch (error) {
      results.push({
        userId: recipient.userId,
        status: "failed",
        providerMessageId: null,
        error: error instanceof Error ? error.message : "Unknown send error",
      });
    }
  }

  const notificationRows = results.map((item) => ({
    user_id: item.userId,
    channel: "sms",
    event_type: "admin_sms_campaign",
    status: item.status,
    attempt_count: 1,
    last_attempt_at: new Date().toISOString(),
    last_error: item.error,
    correlation_id: correlationId,
    metadata: {
      targetType,
      includeStaff,
    },
    provider_message_id: item.providerMessageId,
  }));
  const { error: logError } = await ctx.supabase.from("notification_events").insert(notificationRows);
  if (logError) return NextResponse.json({ error: logError.message, correlationId }, { status: 500 });

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.length - sent;
  return NextResponse.json({
    ok: true,
    correlationId,
    attempted: results.length,
    sent,
    failed,
    failedRecipients: results
      .filter((r) => r.status === "failed")
      .slice(0, 10)
      .map((r) => ({ userId: r.userId, error: r.error })),
  });
}
