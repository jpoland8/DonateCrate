import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkEligibility } from "@/lib/eligibility";
import { fallbackCoordsForPostalCode } from "@/lib/geo";
import { geocodeAddress } from "@/lib/geocode";

const bodySchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  addressLine1: z.string().min(5),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().length(2),
  postalCode: z.string().min(5),
  referralCode: z.string().optional(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createSupabaseAdminClient();

  try {
    const eligibility = await checkEligibility({
      postalCode: input.postalCode,
    });

    if (eligibility.status === "active") {
      return NextResponse.json(
        {
          error: "Address is already eligible",
          message: "This address appears active. Continue to signup instead of waitlist.",
        },
        { status: 409 },
      );
    }

    const geocoded = await geocodeAddress(input);
    const fallbackCoords = fallbackCoordsForPostalCode(input.postalCode);
    const { data, error } = await supabase
      .from("waitlist_entries")
      .upsert(
        {
          full_name: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone ?? null,
          address_line1: input.addressLine1,
          address_line2: input.addressLine2 ?? null,
          city: input.city,
          state: input.state.toUpperCase(),
          postal_code: input.postalCode,
          referral_code: input.referralCode ?? null,
          lat: geocoded?.lat ?? fallbackCoords?.lat ?? null,
          lng: geocoded?.lng ?? fallbackCoords?.lng ?? null,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email,postal_code" },
      )
      .select("id,status,created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      waitlistEntry: data,
      message: "You are on the waitlist. We will notify you when your zone opens.",
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
