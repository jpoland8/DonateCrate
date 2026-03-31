import { NextResponse } from "next/server";
import { createCorrelationId } from "@/lib/api-auth";
import { buildNotificationEmailContent, getEmailConfigError } from "@/lib/email";
import { normalizeToE164US } from "@/lib/twilio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadReminderTemplates, renderTemplate, isReminderEnabled, type ReminderTemplates } from "@/lib/reminder-templates";

type Cadence = "72h" | "24h" | "day_of";

function buildReminderMessage(pickupDate: string, cadence: Cadence, templates: ReminderTemplates, windowLabel?: string | null) {
  const formattedDate = new Date(pickupDate).toLocaleDateString();
  const key = `sms_${cadence}` as keyof ReminderTemplates;
  const template = templates[key];
  const pickup_window_suffix = windowLabel ? ` between ${windowLabel}` : "";
  return renderTemplate(typeof template === "string" ? template : "", { pickup_date: formattedDate, pickup_window_suffix });
}

function cadenceForDaysAway(daysAway: number): Cadence | null {
  if (daysAway === 3) return "72h";
  if (daysAway === 1) return "24h";
  if (daysAway === 0) return "day_of";
  return null;
}

function eventTypeForCadence(cadence: Cadence) {
  if (cadence === "72h") return "pickup_reminder_72h";
  if (cadence === "24h") return "pickup_reminder_24h";
  return "pickup_reminder_day_of";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const correlationId = createCorrelationId("cron_remind");
  const supabase = createSupabaseAdminClient();
  const templates = await loadReminderTemplates(supabase);

  // Compute the date range: today through 3 days from now
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Find pickup cycles with pickup_date between today and 3 days from now
  const { data: cycles, error: cycleError } = await supabase
    .from("pickup_cycles")
    .select("id,pickup_date,zone_id,pickup_window_label")
    .gte("pickup_date", today)
    .lte("pickup_date", threeDaysOut);

  if (cycleError) {
    return NextResponse.json({ error: cycleError.message, correlationId }, { status: 500 });
  }

  if (!cycles || cycles.length === 0) {
    return NextResponse.json({ ok: true, correlationId, queued: 0, cycles_checked: 0 });
  }

  // Cache partner branding per zone to avoid duplicate fetches
  type PartnerBranding = {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    websiteUrl?: string | null;
    receiptFooter?: string | null;
  };
  const zonePartnerCache = new Map<string, PartnerBranding | null>();

  async function getPartnerBrandingForZone(zoneId: string | null): Promise<PartnerBranding | null> {
    if (!zoneId) return null;
    if (zonePartnerCache.has(zoneId)) return zonePartnerCache.get(zoneId)!;

    const { data: zone } = await supabase
      .from("service_zones")
      .select("partner_id")
      .eq("id", zoneId)
      .single();

    if (!zone?.partner_id) {
      zonePartnerCache.set(zoneId, null);
      return null;
    }

    const { data: partner } = await supabase
      .from("nonprofit_partners")
      .select("name,branding")
      .eq("id", zone.partner_id)
      .single();

    if (!partner) {
      zonePartnerCache.set(zoneId, null);
      return null;
    }

    const branding = typeof partner.branding === "object" && partner.branding !== null
      ? (partner.branding as Record<string, unknown>)
      : {};

    const result: PartnerBranding = {
      name: partner.name,
      logoUrl: typeof branding.logo_url === "string" ? branding.logo_url : null,
      primaryColor: typeof branding.primary_color === "string" ? branding.primary_color : null,
      websiteUrl: typeof branding.website_url === "string" ? branding.website_url : null,
      receiptFooter: typeof branding.receipt_footer === "string" ? branding.receipt_footer : null,
    };

    zonePartnerCache.set(zoneId, result);
    return result;
  }

  let totalQueued = 0;
  const cycleResults: Array<{ cycle_id: string; pickup_date: string; cadence: Cadence; queued: number }> = [];

  for (const cycle of cycles) {
    const pickupDate = new Date(cycle.pickup_date + "T00:00:00");
    const todayDate = new Date(today + "T00:00:00");
    const daysAway = Math.round((pickupDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));
    const cadence = cadenceForDaysAway(daysAway);
    if (!cadence) continue;

    const eventType = eventTypeForCadence(cadence);

    // Deduplication: check if reminders for this cycle + cadence already exist
    const { count: existingCount } = await supabase
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", eventType)
      .contains("metadata", { pickup_cycle_id: cycle.id });

    if (existingCount && existingCount > 0) {
      cycleResults.push({ cycle_id: cycle.id, pickup_date: cycle.pickup_date, cadence, queued: 0 });
      continue;
    }

    // Find users with active pickup requests for this cycle
    const { data: requests, error: requestError } = await supabase
      .from("pickup_requests")
      .select("id,user_id,status")
      .eq("pickup_cycle_id", cycle.id)
      .in("status", ["requested", "confirmed"]);

    if (requestError) continue;

    const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
    if (userIds.length === 0) {
      cycleResults.push({ cycle_id: cycle.id, pickup_date: cycle.pickup_date, cadence, queued: 0 });
      continue;
    }

    const [{ data: users }, { data: preferences }] = await Promise.all([
      supabase.from("users").select("id,email,full_name,phone").in("id", userIds),
      supabase.from("notification_preferences").select("user_id,sms_enabled,email_enabled").in("user_id", userIds),
    ]);

    const emailReady = !getEmailConfigError();
    const partnerBranding = await getPartnerBrandingForZone(cycle.zone_id ?? null);
    const preferenceMap = new Map((preferences ?? []).map((item) => [item.user_id, item]));
    const rows = (users ?? []).flatMap((user) => {
      const prefs = preferenceMap.get(user.id);
      const to = normalizeToE164US(user.phone);
      const smsEnabled = prefs ? prefs.sms_enabled === true : true;
      const emailEnabled = prefs ? prefs.email_enabled === true : true;
      const nextRows: Array<Record<string, unknown>> = [];

      if (to && smsEnabled && isReminderEnabled(templates, "sms", cadence)) {
        nextRows.push({
          user_id: user.id,
          channel: "sms",
          event_type: eventType,
          status: "queued",
          correlation_id: correlationId,
          metadata: {
            to,
            body: buildReminderMessage(cycle.pickup_date, cadence, templates, (cycle as Record<string, unknown>).pickup_window_label as string | null | undefined),
            pickup_cycle_id: cycle.id,
            pickup_date: cycle.pickup_date,
            pickup_window_label: (cycle as Record<string, unknown>).pickup_window_label ?? null,
            cadence,
          },
        });
      }

      if (emailReady && user.email && emailEnabled && isReminderEnabled(templates, "email", cadence)) {
        const emailMetadata: Record<string, unknown> = {
          pickup_cycle_id: cycle.id,
          pickup_date: cycle.pickup_date,
          pickup_window_label: (cycle as Record<string, unknown>).pickup_window_label ?? null,
          cadence,
          custom_subject: String(templates[`email_subject_${cadence}` as keyof ReminderTemplates] ?? ""),
          custom_intro: String(templates[`email_intro_${cadence}` as keyof ReminderTemplates] ?? ""),
          custom_body: String(templates[`email_body_${cadence}` as keyof ReminderTemplates] ?? ""),
        };
        if (partnerBranding) {
          emailMetadata.partner = {
            name: partnerBranding.name,
            logoUrl: partnerBranding.logoUrl,
            primaryColor: partnerBranding.primaryColor,
            websiteUrl: partnerBranding.websiteUrl,
            receiptFooter: partnerBranding.receiptFooter,
          };
        }
        const email = buildNotificationEmailContent({
          eventType,
          recipient: { email: user.email, fullName: user.full_name },
          metadata: emailMetadata,
        });
        nextRows.push({
          user_id: user.id,
          channel: "email",
          event_type: eventType,
          status: "queued",
          correlation_id: correlationId,
          metadata: {
            to: user.email,
            full_name: user.full_name,
            pickup_cycle_id: cycle.id,
            pickup_date: cycle.pickup_date,
            cadence,
            subject: email.subject,
            text: email.text,
            html: email.html,
          },
        });
      }

      return nextRows;
    });

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("notification_events").insert(rows);
      if (!insertError) {
        totalQueued += rows.length;
        cycleResults.push({ cycle_id: cycle.id, pickup_date: cycle.pickup_date, cadence, queued: rows.length });
      }
    } else {
      cycleResults.push({ cycle_id: cycle.id, pickup_date: cycle.pickup_date, cadence, queued: 0 });
    }
  }

  return NextResponse.json({
    ok: true,
    correlationId,
    queued: totalQueued,
    cycles_checked: cycles.length,
    details: cycleResults,
  });
}
