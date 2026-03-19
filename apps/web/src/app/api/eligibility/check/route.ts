import { NextResponse } from "next/server";
import { z } from "zod";
import { checkEligibility } from "@/lib/eligibility";
import { geocodeAddress } from "@/lib/geocode";

const bodySchema = z.object({
  addressLine1: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  postalCode: z.string().min(5),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:4321",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    const geocoded = await geocodeAddress(parsed.data);
    const refinedResult = await checkEligibility({
      postalCode: parsed.data.postalCode,
      lat: geocoded?.lat ?? parsed.data.lat,
      lng: geocoded?.lng ?? parsed.data.lng,
    });

    return NextResponse.json({
      status: refinedResult.status,
      zone: refinedResult.zone?.code ?? null,
      zoneName: refinedResult.zone?.name ?? null,
      distanceMiles: refinedResult.distanceMiles,
      reason: refinedResult.reason,
      geocoded: Boolean(geocoded),
      message:
        refinedResult.status === "active"
          ? "Great news. DonateCrate service is available at this address."
          : refinedResult.zone
            ? "This address is in a planned pickup area, but signup is not open yet. Join the waitlist for launch access."
            : "This address is outside active service areas. Join the waitlist.",
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Eligibility check failed", details: String(error) },
      { status: 500, headers: corsHeaders },
    );
  }
}
