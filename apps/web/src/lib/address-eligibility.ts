import { checkEligibility } from "@/lib/eligibility";
import { geocodeAddress } from "@/lib/geocode";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SavedAddress = {
  id: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
};

export async function checkSavedAddressEligibility(address: SavedAddress | null) {
  if (!address?.postal_code) return null;

  let coords =
    address.lat != null && address.lng != null
      ? { lat: address.lat, lng: address.lng }
      : null;

  if (!coords && address.address_line1 && address.city && address.state) {
    coords = await geocodeAddress({
      addressLine1: address.address_line1,
      city: address.city,
      state: address.state,
      postalCode: address.postal_code,
    });

    if (coords) {
      try {
        await createSupabaseAdminClient()
          .from("addresses")
          .update({ lat: coords.lat, lng: coords.lng })
          .eq("id", address.id);
      } catch {
        // Non-fatal: eligibility can still proceed with the geocoded coordinates.
      }
    }
  }

  return checkEligibility({
    postalCode: address.postal_code,
    lat: coords?.lat,
    lng: coords?.lng,
  });
}
