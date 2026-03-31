import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { adminLimiter } from "@/lib/rate-limit";

const patchSchema = z.object({
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pickupWindowLabel: z.string().max(120).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cycleId: string }> },
) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { cycleId } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.pickupDate !== undefined) {
    updates.pickup_date = parsed.data.pickupDate;
    // Recalculate cycle_month from new pickup date
    updates.cycle_month = parsed.data.pickupDate.slice(0, 7) + "-01";
    // Cutoff is midnight of pickup day
    updates.request_cutoff_at = `${parsed.data.pickupDate}T00:00:00.000Z`;
  }
  if ("pickupWindowLabel" in parsed.data) {
    updates.pickup_window_label = parsed.data.pickupWindowLabel?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("pickup_cycles")
    .update(updates)
    .eq("id", cycleId)
    .select("id,zone_id,cycle_month,pickup_date,pickup_window_label")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  return NextResponse.json({ ok: true, pickupCycle: data });
}
