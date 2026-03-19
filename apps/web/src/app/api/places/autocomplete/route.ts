import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  query: z.string().min(3),
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
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400, headers: corsHeaders });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500, headers: corsHeaders });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
    },
    body: JSON.stringify({
      input: parsed.data.query,
      includedPrimaryTypes: ["street_address"],
      includedRegionCodes: ["us"],
    }),
  });
  if (!response.ok) return NextResponse.json({ error: "Autocomplete request failed" }, { status: 502, headers: corsHeaders });

  const json = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
    error?: { message?: string };
  };

  if (json.error?.message) return NextResponse.json({ error: json.error.message }, { status: 502, headers: corsHeaders });

  return NextResponse.json({
    predictions: (json.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction?.placeId))
      .map((prediction) => ({
      placeId: prediction.placeId!,
      description: prediction.text?.text ?? "",
      mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
    })),
  }, { headers: corsHeaders });
}
