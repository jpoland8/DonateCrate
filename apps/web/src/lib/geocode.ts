import { Coordinates } from "@/lib/geo";

type AddressInput = {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

export async function geocodeAddress(input: AddressInput): Promise<Coordinates | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const query = encodeURIComponent(
    `${input.addressLine1}, ${input.city}, ${input.state} ${input.postalCode}, USA`,
  );
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const json = (await response.json()) as {
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
    status?: string;
  };

  const location = json.results?.[0]?.geometry?.location;
  if (!location?.lat || !location?.lng) return null;

  return { lat: location.lat, lng: location.lng };
}
