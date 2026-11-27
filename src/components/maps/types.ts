import type * as React from "react";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: "driver" | "pickup" | "delivery" | "point";
  label?: string;
  color?: string;
  /** show a pulsing ring (live driver) */
  live?: boolean;
  popup?: React.ReactNode;
}

export interface MapViewProps {
  markers: MapMarker[];
  /** polyline as [lat, lng] pairs */
  route?: [number, number][] | null;
  className?: string;
  fit?: boolean;
  /** only auto-fit the first time markers appear (for live-updating maps) */
  fitOnce?: boolean;
  focus?: [number, number] | null;
  padding?: number;
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (id: string) => void;
}
