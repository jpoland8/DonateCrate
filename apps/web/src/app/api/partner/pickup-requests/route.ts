import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { sendPartnerDonationReceipt } from "@/lib/partner-donation-receipt";
import { userCanAccessPartner } from "@/lib/partner-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["picked_up", "missed", "requested"]),
});

export async function PATCH(request: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.partnerRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.partnerRole === "partner_driver") {
    return NextResponse.json({ error: "Drivers can only update pickups through their assigned route stops" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { data: requestRow, error: requestError } = await ctx.supabase
    .from("pickup_requests")
    .select("id,status,pickup_cycle_id,pickup_cycles!inner(pickup_date,zone_id,service_zones!inner(partner_id))")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: requestError?.message ?? "Pickup request not found" }, { status: 404 });
  }

  const cycle = Array.isArray(requestRow.pickup_cycles) ? requestRow.pickup_cycles[0] : requestRow.pickup_cycles;
  const zone = cycle && "service_zones" in cycle ? (Array.isArray(cycle.service_zones) ? cycle.service_zones[0] : cycle.service_zones) : null;
  const partnerId = zone?.partner_id ?? null;
  if (!partnerId) return NextResponse.json({ error: "Pickup request is not assigned to a partner zone" }, { status: 403 });

  const canAccess = await userCanAccessPartner({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    partnerId,
  });
  if (!canAccess) {
    return NextResponse.json({ error: "This pickup request is not assigned to your nonprofit" }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const nextNote =
    parsed.data.status === "picked_up" ? null : parsed.data.status === "missed" ? "Partner marked pickup as could not be retrieved" : null;
  const pickupDate = cycle?.pickup_date ?? null;
  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("pickup_requests")
    .update({
      status: parsed.data.status,
      note: nextNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId)
    .select("id,status,note")
    .limit(1);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (parsed.data.status === "picked_up" && requestRow.status !== "picked_up") {
    await sendPartnerDonationReceipt({
      supabase: supabaseAdmin,
      pickupRequestId: requestRow.id,
      partnerId,
      donationDate: pickupDate,
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, pickupRequest: updatedRows?.[0] ?? null });
}
