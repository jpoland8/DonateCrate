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
  "37922": { lat: 35.8736, lng: -84.1764 },
};

export function fallbackCoordsForPostalCode(postalCode: string): Coordinates | null {
  return postalCodeFallbacks[postalCode] ?? null;
}
