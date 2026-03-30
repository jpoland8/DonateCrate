import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { adminLimiter } from "@/lib/rate-limit";

const createReminderSchema = z.object({
  message: z.string().min(1).max(600),
  targetType: z.enum(["zone", "all"]),
  zoneId: z.string().uuid().optional(),
  scheduledFor: z.string(),
  includeStaff: z.boolean().default(false),
}).refine(
  (data) => data.targetType !== "zone" || !!data.zoneId,
  { message: "zoneId is required when targetType is 'zone'", path: ["zoneId"] },
).refine(
  (data) => new Date(data.scheduledFor) > new Date(),
  { message: "scheduledFor must be in the future", path: ["scheduledFor"] },
);

const deleteReminderSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

  let query = ctx.supabase
    .from("notification_events")
    .select("id,status,channel,metadata,created_at")
    .eq("event_type", "admin_scheduled_sms");

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  if (statusFilter === "scheduled") {
    query = query.order("metadata->scheduled_for", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = createReminderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { message, targetType, zoneId, scheduledFor, includeStaff } = parsed.data;

  const { data, error } = await ctx.supabase
    .from("notification_events")
    .insert({
      event_type: "admin_scheduled_sms",
      channel: "sms",
      status: "scheduled",
      user_id: null,
      metadata: {
        message,
        targetType,
        zoneId: zoneId ?? null,
        includeStaff,
        scheduled_for: scheduledFor,
        created_by: ctx.profile.id,
      },
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id, scheduledFor });
}

export async function DELETE(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = deleteReminderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id } = parsed.data;

  // Only allow canceling if still scheduled
  const { data: existing, error: fetchError } = await ctx.supabase
    .from("notification_events")
    .select("id,status")
    .eq("id", id)
    .eq("event_type", "admin_scheduled_sms")
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  if (existing.status !== "scheduled") {
    return NextResponse.json({ error: "Only scheduled reminders can be canceled" }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from("notification_events")
    .update({ status: "canceled" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, canceled: true });
}
