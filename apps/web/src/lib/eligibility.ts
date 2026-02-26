import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fallbackCoordsForPostalCode, milesBetween } from "@/lib/geo";

type CheckEligibilityInput = {
  postalCode: string;
  lat?: number | null;
  lng?: number | null;
};

export async function checkEligibility(input: CheckEligibilityInput) {
  const supabase = createSupabaseAdminClient();
  const { data: zones, error } = await supabase
    .from("service_zones")
    .select("id,code,name,anchor_postal_code,center_lat,center_lng,radius_miles,status,signup_enabled")
    .in("status", ["active", "launching", "pending"]);

  if (error) {
    throw new Error(error.message);
  }

  const coords =
    input.lat != null && input.lng != null
      ? { lat: input.lat, lng: input.lng }
      : fallbackCoordsForPostalCode(input.postalCode);

  const exactPostalMatch = zones?.find((zone) => zone.anchor_postal_code === input.postalCode);

  if (exactPostalMatch && exactPostalMatch.status === "active" && exactPostalMatch.signup_enabled) {
    return {
      status: "active" as const,
      zone: exactPostalMatch,
      distanceMiles: 0,
      reason: "Matched active zone by postal code.",
    };
  }

  if (coords) {
    const eligible = zones
      ?.filter((zone) => zone.center_lat != null && zone.center_lng != null)
      .map((zone) => {
        const distanceMiles = milesBetween(coords, {
          lat: zone.center_lat as number,
          lng: zone.center_lng as number,
        });
        return { zone, distanceMiles };
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles)[0];

    if (eligible && eligible.distanceMiles <= Number(eligible.zone.radius_miles)) {
      const canSignup = eligible.zone.status === "active" && Boolean(eligible.zone.signup_enabled);
      return {
        status: canSignup ? ("active" as const) : ("pending" as const),
        zone: eligible.zone,
        distanceMiles: Number(eligible.distanceMiles.toFixed(2)),
        reason: canSignup ? "Address is inside active signup radius." : "Address is inside route radius but signup is not enabled yet.",
      };
    }
  }

  return {
    status: "pending" as const,
    zone: null,
    distanceMiles: null,
    reason: "Outside active radius; eligible for waitlist.",
  };
}
