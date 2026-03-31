import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { apiLimiter } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, profile } = ctx;

  const [{ data: pickupRequests, error: pickupError }, { data: receiptEvents, error: receiptError }] =
    await Promise.all([
      supabase
        .from("pickup_requests")
        .select("id,status,updated_at,pickup_cycles(id,pickup_date),service_zones(id,name)")
        .eq("user_id", profile.id)
        .in("status", ["picked_up", "completed"])
        .order("updated_at", { ascending: false }),
      supabase
        .from("notification_events")
        .select("id,metadata,created_at")
        .eq("user_id", profile.id)
        .eq("event_type", "partner_donation_receipt")
        .order("created_at", { ascending: false }),
    ]);

  if (pickupError || receiptError) {
    return NextResponse.json(
      { error: "Could not load receipt history." },
      { status: 500 },
    );
  }

  // Index receipt events by pickup_request_id for fast lookup
  const receiptsByPickupId = new Map<string, { receipt_id: string; created_at: string }>();
  for (const event of receiptEvents ?? []) {
    const meta = event.metadata as Record<string, unknown> | null;
    const pickupRequestId = meta?.pickup_request_id as string | undefined;
    if (pickupRequestId && !receiptsByPickupId.has(pickupRequestId)) {
      receiptsByPickupId.set(pickupRequestId, {
        receipt_id: `DC-${pickupRequestId.slice(0, 8).toUpperCase()}`,
        created_at: event.created_at,
      });
    }
  }

  const receipts = (pickupRequests ?? []).map((pr) => {
    const cycle = Array.isArray(pr.pickup_cycles) ? pr.pickup_cycles[0] : pr.pickup_cycles;
    const zone = Array.isArray(pr.service_zones) ? pr.service_zones[0] : pr.service_zones;
    const receiptMatch = receiptsByPickupId.get(pr.id);

    return {
      id: pr.id,
      pickup_date: cycle?.pickup_date ?? null,
      status: pr.status,
      zone_name: zone?.name ?? null,
      receipt_id: receiptMatch?.receipt_id ?? null,
      receipt_sent_at: receiptMatch?.created_at ?? null,
      has_receipt: Boolean(receiptMatch),
    };
  });

  // Sort by pickup_date descending, falling back to updated_at
  receipts.sort((a, b) => {
    const dateA = a.pickup_date ?? "";
    const dateB = b.pickup_date ?? "";
    return dateB.localeCompare(dateA);
  });

  return NextResponse.json({ receipts });
}
