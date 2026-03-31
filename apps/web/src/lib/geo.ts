export type Coordinates = {
  lat: number;
  lng: number;
};

export function milesBetween(a: Coordinates, b: Coordinates) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

const postalCodeFallbacks: Record<string, Coordinates> = {
  // Knoxville west / Farragut service zone (center: 35.8736, -84.1764)
  "37922": { lat: 35.8736, lng: -84.1764 },
  "37934": { lat: 35.8726, lng: -84.2259 },
  "37919": { lat: 35.9142, lng: -84.0271 },
  "37932": { lat: 35.9120, lng: -84.1865 },
  "37931": { lat: 35.9330, lng: -84.1550 },
};

export function fallbackCoordsForPostalCode(postalCode: string): Coordinates | null {
  return postalCodeFallbacks[postalCode] ?? null;
}
