import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { adminLimiter } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SETTINGS_KEY = "reminder_templates";

const DEFAULT_TEMPLATES: Record<string, string> = {
  sms_72h:
    "DonateCrate reminder: your pickup is coming up on {{pickup_date}}. Start filling your bag now so it is ready for route day.",
  sms_24h:
    "DonateCrate reminder: your pickup is tomorrow, {{pickup_date}}. Place your bag out before route time.",
  sms_day_of:
    "DonateCrate reminder: pickup day is here. Place your DonateCrate bag out for collection today, {{pickup_date}}.",
  email_subject_72h: "Your DonateCrate pickup is coming up",
  email_subject_24h: "Your DonateCrate pickup is tomorrow",
  email_subject_day_of: "Pickup day is here",
  email_intro_72h: "Your next monthly pickup is getting close.",
  email_intro_24h: "Your bag should be ready by tomorrow.",
  email_intro_day_of: "Today is pickup day for your DonateCrate bag.",
  email_body_72h:
    "We are scheduled to stop by on {{pickup_date}}. Keep your orange bag ready and place it out before route time.",
  email_body_24h:
    "We are scheduled to stop by tomorrow, {{pickup_date}}. Make sure your orange bag is packed and placed out before route time.",
  email_body_day_of:
    "Today is the day! Place your orange bag out for collection. We will be by on {{pickup_date}}.",
};

const updateSchema = z.object({
  templates: z.record(z.string(), z.string().max(1000)),
});

export async function GET(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const templates = data?.value ?? DEFAULT_TEMPLATES;
  // Merge defaults for any missing keys
  const merged = { ...DEFAULT_TEMPLATES, ...(typeof templates === "object" && templates !== null ? templates : {}) };

  return NextResponse.json({ templates: merged });
}

export async function PUT(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Merge with defaults to ensure all keys exist
  const merged = { ...DEFAULT_TEMPLATES, ...parsed.data.templates };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: SETTINGS_KEY, value: merged, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, templates: merged });
}
