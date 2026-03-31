"use client";
import { useEffect, useRef } from "react";

type Entry = {
  id: string;
  lat?: number | null;
  lng?: number | null;
  full_name?: string | null;
  postal_code?: string | null;
  city?: string | null;
  status?: string | null;
};

export function WaitlistMap({ entries }: { entries: Entry[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  const pinned = entries.filter((e) => e.lat && e.lng);

  useEffect(() => {
    if (!mapRef.current || pinned.length === 0) return;
    if (mapInstanceRef.current) return; // already initialized

    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS then initialize map
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      if (!mapRef.current) return;

      const lats = pinned.map((e) => e.lat as number);
      const lngs = pinned.map((e) => e.lng as number);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([centerLat, centerLng], 8);
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      // Group by postal code and show count pins
      const grouped = new Map<string, { lat: number; lng: number; count: number; city: string | null }>();
      for (const e of pinned) {
        const key = e.postal_code ?? `${e.lat},${e.lng}`;
        if (grouped.has(key)) {
          grouped.get(key)!.count++;
        } else {
          grouped.set(key, { lat: e.lat as number, lng: e.lng as number, count: 1, city: e.city ?? null });
        }
      }

      for (const [postal, g] of grouped.entries()) {
        const size = Math.min(32 + g.count * 4, 56);
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,106,0,0.85);border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${g.count > 1 ? "12px" : "10px"};box-shadow:0 2px 8px rgba(0,0,0,0.3)">${g.count > 1 ? g.count : "·"}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        L.marker([g.lat, g.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${postal}</strong>${g.city ? ` · ${g.city}` : ""}<br/>${g.count} waiting`);
      }
    };
    document.head.appendChild(script);

    return () => {
      // cleanup if needed
    };
  }, []); // eslint-disable-line

  if (pinned.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-admin bg-admin-panel px-4 py-3 text-xs text-admin-soft">
        No coordinates available to show on map. Entries show in the table below.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="mt-4 h-64 w-full rounded-2xl overflow-hidden border border-admin"
      style={{ zIndex: 0 }}
    />
  );
}
