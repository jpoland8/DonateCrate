import { NextResponse } from "next/server";
import { z } from "zod";
import { checkEligibility } from "@/lib/eligibility";
import { geocodeAddress } from "@/lib/geocode";
import { apiLimiter } from "@/lib/rate-limit";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().length(2),
  postalCode: z.string().min(5).max(10),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(request: Request) {
  const limited = apiLimiter.check(request);
  if (limited) return limited;

  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const geocoded = parsed.data.lat && parsed.data.lng
    ? { lat: parsed.data.lat, lng: parsed.data.lng }
    : await geocodeAddress(parsed.data);

  const eligibility = await checkEligibility({
    postalCode: parsed.data.postalCode,
    lat: geocoded?.lat,
    lng: geocoded?.lng,
  });

  const supabase = createSupabaseAdminClient();
  const normalizedState = parsed.data.state.toUpperCase();
  const normalizedPostal = parsed.data.postalCode.trim();

  // Find existing address or insert new one
  const { data: existing } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", ctx.profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("addresses")
      .update({
        address_line1: parsed.data.addressLine1,
        address_line2: parsed.data.addressLine2 ?? null,
        city: parsed.data.city,
        state: normalizedState,
        postal_code: normalizedPostal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("addresses").insert({
      user_id: ctx.profile.id,
      address_line1: parsed.data.addressLine1,
      address_line2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city,
      state: normalizedState,
      postal_code: normalizedPostal,
    });
  }

  return NextResponse.json({
    ok: true,
    zoneStatus: eligibility.status,
    zoneCode: eligibility.zone?.code ?? null,
    zoneName: eligibility.zone?.name ?? null,
    isActive: eligibility.status === "active",
    address: {
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city,
      state: normalizedState,
      postalCode: normalizedPostal,
    },
  });
}
