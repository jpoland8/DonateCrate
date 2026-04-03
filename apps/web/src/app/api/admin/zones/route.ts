import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { adminLimiter } from "@/lib/rate-limit";

async function resolvePlaceCenter(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Google Places API key not configured");

  const encodedId = encodeURIComponent(placeId);
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodedId}`, {
    cache: "no-store",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,location",
    },
  });
  if (!response.ok) throw new Error("Could not resolve area center address");

  const json = (await response.json()) as {
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    error?: { message?: string };
  };
  if (json.error?.message) throw new Error(json.error.message);

  const lat = json.location?.latitude;
  const lng = json.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("Selected address is missing map coordinates");
  }

  return {
    center_lat: lat,
    center_lng: lng,
    center_address: json.formattedAddress ?? null,
  };
}

const createZoneSchema = z.object({
  code: z.string().min(3),
  name: z.string().min(3),
  anchorPostalCode: z.string().min(3),
  radiusMiles: z.number().min(0.5).max(50).default(3),
  minActiveSubscribers: z.number().int().min(1).max(10000).default(40),
  centerPlaceId: z.string().min(8),
  signupEnabled: z.boolean().default(false),
  demoOnly: z.boolean().default(false),
  operationModel: z.enum(["donatecrate_operated", "partner_operated"]).default("donatecrate_operated"),
  partnerId: z.string().uuid().nullable().optional(),
  partnerPickupDateOverrideAllowed: z.boolean().default(false),
  recurringPickupDay: z.number().int().min(1).max(31).nullable().optional(),
  defaultCutoffDaysBefore: z.number().int().min(0).max(30).default(7),
  defaultPickupWindowLabel: z.string().max(120).optional(),
  partnerNotes: z.string().optional(),
});

const updateZoneSchema = z.object({
  zoneId: z.string().uuid(),
  radiusMiles: z.number().min(0.5).max(50).optional(),
  status: z.enum(["pending", "launching", "active", "paused"]).optional(),
  minActiveSubscribers: z.number().int().min(1).max(10000).optional(),
  centerPlaceId: z.string().min(8).optional(),
  signupEnabled: z.boolean().optional(),
  demoOnly: z.boolean().optional(),
  operationModel: z.enum(["donatecrate_operated", "partner_operated"]).optional(),
  partnerId: z.string().uuid().nullable().optional(),
  partnerPickupDateOverrideAllowed: z.boolean().optional(),
  recurringPickupDay: z.number().int().min(1).max(31).nullable().optional(),
  defaultCutoffDaysBefore: z.number().int().min(0).max(30).optional(),
  defaultPickupWindowLabel: z.string().max(120).optional(),
  partnerNotes: z.string().optional(),
});

export async function GET(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await ctx.supabase
    .from("service_zones")
    .select("*, nonprofit_partners(id,name,code)")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    zones: (data ?? []).map((zone) => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      anchor_postal_code: zone.anchor_postal_code,
      radius_miles: zone.radius_miles,
      min_active_subscribers: zone.min_active_subscribers,
      status: zone.status,
      center_lat: zone.center_lat ?? null,
      center_lng: zone.center_lng ?? null,
      center_address: zone.center_address ?? null,
      signup_enabled: zone.signup_enabled ?? false,
      demo_only: zone.demo_only ?? false,
      operation_model: zone.operation_model ?? "donatecrate_operated",
      partner_id: zone.partner_id ?? null,
      partner_pickup_date_override_allowed: zone.partner_pickup_date_override_allowed ?? false,
      recurring_pickup_day: zone.recurring_pickup_day ?? null,
      default_cutoff_days_before: zone.default_cutoff_days_before ?? 7,
      default_pickup_window_label: zone.default_pickup_window_label ?? null,
      partner_notes: zone.partner_notes ?? null,
      partner: Array.isArray(zone.nonprofit_partners) ? zone.nonprofit_partners[0] ?? null : zone.nonprofit_partners ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = createZoneSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input = parsed.data;
  const center = await resolvePlaceCenter(input.centerPlaceId);
  const { data, error } = await ctx.supabase
    .from("service_zones")
    .insert({
      code: input.code.toLowerCase(),
      name: input.name,
      anchor_postal_code: input.anchorPostalCode,
      radius_miles: input.radiusMiles,
      min_active_subscribers: input.minActiveSubscribers,
      status: "launching",
      center_lat: center.center_lat,
      center_lng: center.center_lng,
      center_address: center.center_address,
      signup_enabled: input.signupEnabled,
      demo_only: input.demoOnly,
      operation_model: input.operationModel,
      partner_id: input.partnerId ?? null,
      partner_pickup_date_override_allowed: input.partnerPickupDateOverrideAllowed,
      recurring_pickup_day: input.recurringPickupDay ?? null,
      default_cutoff_days_before: input.defaultCutoffDaysBefore,
      default_pickup_window_label: input.defaultPickupWindowLabel?.trim() ? input.defaultPickupWindowLabel.trim() : null,
      partner_notes: input.partnerNotes?.trim() ? input.partnerNotes.trim() : null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, zone: data });
}

export async function PATCH(request: Request) {
  const limited = adminLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = updateZoneSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input = parsed.data;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.radiusMiles === "number") patch.radius_miles = input.radiusMiles;
  if (typeof input.status === "string") patch.status = input.status;
  if (typeof input.minActiveSubscribers === "number") patch.min_active_subscribers = input.minActiveSubscribers;
  if (typeof input.signupEnabled === "boolean") patch.signup_enabled = input.signupEnabled;
  if (typeof input.demoOnly === "boolean") patch.demo_only = input.demoOnly;
  if (typeof input.operationModel === "string") patch.operation_model = input.operationModel;
  if (input.partnerId !== undefined) patch.partner_id = input.partnerId;
  if (typeof input.partnerPickupDateOverrideAllowed === "boolean") {
    patch.partner_pickup_date_override_allowed = input.partnerPickupDateOverrideAllowed;
  }
  if (input.recurringPickupDay !== undefined) patch.recurring_pickup_day = input.recurringPickupDay;
  if (typeof input.defaultCutoffDaysBefore === "number") patch.default_cutoff_days_before = input.defaultCutoffDaysBefore;
  if (input.defaultPickupWindowLabel !== undefined) {
    patch.default_pickup_window_label = input.defaultPickupWindowLabel.trim() ? input.defaultPickupWindowLabel.trim() : null;
  }
  if (input.partnerNotes !== undefined) patch.partner_notes = input.partnerNotes.trim() ? input.partnerNotes.trim() : null;
  if (typeof input.centerPlaceId === "string") {
    const center = await resolvePlaceCenter(input.centerPlaceId);
    patch.center_lat = center.center_lat;
    patch.center_lng = center.center_lng;
    patch.center_address = center.center_address;
  }

  const { data, error } = await ctx.supabase
    .from("service_zones")
    .update(patch)
    .eq("id", input.zoneId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, zone: data });
}
