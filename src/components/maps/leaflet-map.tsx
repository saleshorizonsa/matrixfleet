"use client";
import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from "react-leaflet";
import type { MapMarker, MapViewProps } from "./types";

/** Marker HTML is built as a string, so every value must be safe: colours are validated, text escaped. */
const HEX = /^#[0-9a-fA-F]{6}$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function iconFor(m: MapMarker) {
  const fallback = m.kind === "pickup" ? "#0ea5e9" : m.kind === "delivery" ? "#10b981" : "#5B5BF7";
  const color = m.color && HEX.test(m.color) ? m.color : fallback;
  if (m.kind === "driver") {
    const initials = (m.label ?? "")
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
    const pulse = m.live
      ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:.35;animation:pulse-ring 1.8s cubic-bezier(.2,.6,.4,1) infinite"></span>`
      : "";
    return L.divIcon({
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
      html: `<div style="position:relative;width:36px;height:36px">${pulse}<div style="position:relative;width:36px;height:36px;border-radius:9999px;background:${color};color:#fff;display:grid;place-items:center;font:600 12px/1 Inter,system-ui,sans-serif;border:3px solid #fff;box-shadow:0 4px 14px rgba(10,20,48,.35)">${esc(initials) || "•"}</div></div>`,
    });
  }
  const letter = m.kind === "pickup" ? "A" : m.kind === "delivery" ? "B" : "";
  return L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(10,20,48,.35))"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 26 15 40 15 40s15-14 15-25.2C30 6.6 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="14.5" r="9" fill="#fff"/><text x="15" y="19" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="700" fill="${color}">${letter}</text></svg>`,
  });
}

function FitBounds({ points, padding, once }: { points: [number, number][]; padding: number; once?: boolean }) {
  const map = useMap();
  const done = React.useRef(false);
  const key = points.map((p) => p.join(",")).join("|");
  React.useEffect(() => {
    if (!points.length || (once && done.current)) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 11);
    else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, padding]);
  return null;
}

function FlyTo({ focus }: { focus?: [number, number] | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (focus) map.flyTo(focus, Math.max(map.getZoom(), 12), { duration: 0.8 });
  }, [focus, map]);
  return null;
}

export default function LeafletMap({
  markers,
  route,
  className,
  fit = true,
  fitOnce = false,
  focus,
  padding = 48,
  onMarkerClick,
  center = [52.5, 1.5],
  zoom = 5,
}: MapViewProps) {
  const pts = markers.map((m) => [m.lat, m.lng] as [number, number]);
  const fitPoints = route && route.length > 1 ? [...pts, ...route] : pts;
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className={className ?? "h-80 w-full"} style={{ zIndex: 0 }}>
      <TileLayer
        attribution={process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
        url="/api/tiles/{z}/{x}/{y}"
        maxZoom={19}
      />
      {route && route.length > 1 && (
        <>
          <Polyline positions={route} pathOptions={{ color: "#0a1430", weight: 7, opacity: 0.15 }} />
          <Polyline positions={route} pathOptions={{ color: "#5B5BF7", weight: 4, opacity: 0.9, dashArray: route.length === 2 ? "8 8" : undefined }} />
        </>
      )}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={iconFor(m)}
          zIndexOffset={m.kind === "driver" ? 1000 : 0}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
        >
          {m.label && m.kind !== "driver" && <Tooltip direction="top" offset={[0, -34]}>{m.label}</Tooltip>}
          {m.popup && <Popup>{m.popup}</Popup>}
        </Marker>
      ))}
      {fit && <FitBounds points={fitPoints} padding={padding} once={fitOnce} />}
      <FlyTo focus={focus} />
    </MapContainer>
  );
}
