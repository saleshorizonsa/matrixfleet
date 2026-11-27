"use client";
// Client-only map components (Leaflet touches `window`, so it is never server-rendered).
import * as React from "react";
import dynamic from "next/dynamic";
import type { MapViewProps } from "./types";

export type { MapMarker, MapViewProps } from "./types";

function MapSkeleton({ className }: { className?: string }) {
  return <div className={`${className ?? "h-80 w-full"} animate-pulse bg-slate-100`} />;
}

const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false, loading: () => <MapSkeleton /> });

/** Generic map: markers (drivers, pickup A, delivery B) + optional route polyline. */
export function MapView(props: MapViewProps) {
  return <LeafletMap {...props} />;
}

/**
 * Pickup → delivery map that fetches the road route from /api/geo/route.
 * Requires a signed-in user (the API is auth-protected).
 */
export function RouteMap({
  from,
  to,
  className,
  extra = [],
}: {
  from: { lat: number; lng: number; label?: string } | null;
  to: { lat: number; lng: number; label?: string } | null;
  className?: string;
  extra?: MapViewProps["markers"];
}) {
  const [geometry, setGeometry] = React.useState<[number, number][] | null>(null);
  const key = from && to ? `${from.lat},${from.lng},${to.lat},${to.lng}` : "";
  React.useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    const qs = new URLSearchParams({
      fromLat: String(from.lat),
      fromLng: String(from.lng),
      toLat: String(to.lat),
      toLng: String(to.lng),
    });
    fetch(`/api/geo/route?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j?.geometry && setGeometry(j.geometry))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const markers: MapViewProps["markers"] = [...extra];
  if (from) markers.push({ id: "pickup", kind: "pickup", lat: from.lat, lng: from.lng, label: from.label });
  if (to) markers.push({ id: "delivery", kind: "delivery", lat: to.lat, lng: to.lng, label: to.label });
  const fallback: [number, number][] | null = from && to ? [[from.lat, from.lng], [to.lat, to.lng]] : null;
  return <MapView markers={markers} route={geometry ?? fallback} className={className} />;
}
