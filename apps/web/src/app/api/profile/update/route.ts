import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizeToE164US } from "@/lib/twilio";

const bodySchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().length(2),
  postalCode: z.string().min(5).max(10),
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileLookupError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileLookupError || !profile) {
    return NextResponse.json({ error: profileLookupError?.message ?? "Profile not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone ? (normalizeToE164US(parsed.data.phone) ?? parsed.data.phone) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalizedState = parsed.data.state.toUpperCase();
  const normalizedPostal = parsed.data.postalCode.trim();
  const now = new Date().toISOString();

  const { data: existingAddress } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingAddress?.id) {
    const { error: addressUpdateError } = await supabase
      .from("addresses")
      .update({
        address_line1: parsed.data.addressLine1,
        address_line2: parsed.data.addressLine2 ?? null,
        city: parsed.data.city,
        state: normalizedState,
        postal_code: normalizedPostal,
      })
      .eq("id", existingAddress.id);

    if (addressUpdateError) {
      return NextResponse.json({ error: addressUpdateError.message }, { status: 500 });
    }
  } else {
    const { error: addressInsertError } = await supabase.from("addresses").insert({
      user_id: profile.id,
      address_line1: parsed.data.addressLine1,
      address_line2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city,
      state: normalizedState,
      postal_code: normalizedPostal,
      created_at: now,
    });

    if (addressInsertError) {
      return NextResponse.json({ error: addressInsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
