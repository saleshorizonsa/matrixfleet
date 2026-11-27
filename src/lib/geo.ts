import "server-only";
import { COUNTRIES } from "./countries";

const NOMINATIM = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const OSRM = process.env.OSRM_URL || "https://router.project-osrm.org";
const UA = "MatrixFleet/1.0";

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  name: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
}

export interface RouteResult {
  km: number;
  minutes: number;
  geometry: [number, number][]; // [lat, lng]
  estimated: boolean; // true when routing failed and we fell back to straight-line × 1.25
}

const COUNTRY_CODES = COUNTRIES.map((c) => c.code.toLowerCase()).join(",");

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
};

export async function geocode(q: string, countries?: string): Promise<GeoResult[]> {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", countries || COUNTRY_CODES);
  url.searchParams.set("q", q);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const items = (await res.json()) as NominatimItem[];
  return items.map((it) => {
    const a = it.address ?? {};
    const street = [a.house_number, a.road].filter(Boolean).join(" ") || a.pedestrian || a.industrial || null;
    return {
      label: it.display_name,
      lat: Number(it.lat),
      lng: Number(it.lon),
      name: it.name || null,
      address: street,
      city: a.city || a.town || a.village || a.municipality || a.county || null,
      postcode: a.postcode || null,
      country: a.country_code ? a.country_code.toUpperCase() : null,
    };
  });
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function route(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<RouteResult> {
  try {
    const url = `${OSRM}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=simplified&geometries=geojson`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`osrm ${res.status}`);
    const json = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (json.code !== "Ok" || !r) throw new Error("no route");
    return {
      km: Math.round((r.distance / 1000) * 10) / 10,
      minutes: Math.round(r.duration / 60),
      geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      estimated: false,
    };
  } catch {
    const km = Math.round(haversineKm(fromLat, fromLng, toLat, toLng) * 1.25 * 10) / 10;
    return {
      km,
      minutes: Math.round((km / 65) * 60),
      geometry: [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      estimated: true,
    };
  }
}
