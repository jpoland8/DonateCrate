import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  placeId: z.string().min(8),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function componentValue(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
  mode: "long" | "short" = "long",
) {
  const found = components.find((component) => component.types.includes(type));
  return found ? (mode === "short" ? found.short_name : found.long_name) : "";
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid placeId" }, { status: 400, headers: corsHeaders });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500, headers: corsHeaders });
  }

  const placeId = encodeURIComponent(parsed.data.placeId);
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
    },
  });
  if (!response.ok) return NextResponse.json({ error: "Place details request failed" }, { status: 502, headers: corsHeaders });

  const json = (await response.json()) as {
    id?: string;
    formattedAddress?: string;
    addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
    location?: { latitude?: number; longitude?: number };
    error?: { message?: string };
  };

  if (json.error?.message) return NextResponse.json({ error: json.error.message }, { status: 502, headers: corsHeaders });
  if (!json.id) return NextResponse.json({ error: "Place details unavailable" }, { status: 502, headers: corsHeaders });

  const components = (json.addressComponents ?? []).map((item) => ({
    long_name: item.longText,
    short_name: item.shortText,
    types: item.types,
  }));
  const streetNumber = componentValue(components, "street_number");
  const route = componentValue(components, "route");
  const city =
    componentValue(components, "locality") ||
    componentValue(components, "postal_town") ||
    componentValue(components, "sublocality");
  const state = componentValue(components, "administrative_area_level_1", "short");
  const postalCode = componentValue(components, "postal_code");

  const addressLine1 = [streetNumber, route].filter(Boolean).join(" ").trim();

  return NextResponse.json({
    placeId: parsed.data.placeId,
    formattedAddress: json.formattedAddress ?? "",
    addressLine1,
    city,
    state,
    postalCode,
    lat: json.location?.latitude ?? null,
    lng: json.location?.longitude ?? null,
  }, { headers: corsHeaders });
}
