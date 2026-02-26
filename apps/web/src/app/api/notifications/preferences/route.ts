import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";

const bodySchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
});

export async function POST(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { supabase, profile } = ctx;
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: profile.id,
      email_enabled: parsed.data.emailEnabled,
      sms_enabled: parsed.data.smsEnabled,
      quiet_hours_start: parsed.data.quietHoursStart ?? null,
      quiet_hours_end: parsed.data.quietHoursEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
