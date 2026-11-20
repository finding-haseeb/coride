import type { Graph } from "../pages/map_page/types";
import { edgeLine } from "../pages/map_page/metroLines";

/** Metres between two lat/lng points. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface RoutePosition {
  /** Position along the route in stations: 2.4 = 40% of the way from stop 2 to stop 3. */
  progress: number;
  /** How far the point is from the route line, in metres. */
  offRouteM: number;
}

/**
 * Snaps a GPS point onto the route. Uses a flat projection, which is
 * accurate enough at city scale.
 */
export function locateOnRoute(path: string[], graph: Graph, lat: number, lng: number): RoutePosition | null {
  const pts = path.map((s) => graph[s]).filter(Boolean);
  if (pts.length !== path.length || !pts.length) return null;
  if (pts.length === 1) return { progress: 0, offRouteM: distanceM(lat, lng, pts[0].lat, pts[0].lng) };

  const kx = Math.cos((lat * Math.PI) / 180);
  let best: RoutePosition = { progress: 0, offRouteM: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ax = a.lng * kx, ay = a.lat, bx = b.lng * kx, by = b.lat, px = lng * kx, py = lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const d = distanceM(lat, lng, ay + t * dy, (ax + t * dx) / kx);
    if (d < best.offRouteM) best = { progress: i + t, offRouteM: d };
  }
  return best;
}

/** Stops where you change line (index in path). */
export function interchangeStops(path: string[], graph: Graph): number[] {
  const out: number[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const before = edgeLine(graph[path[i - 1]]?.line ?? "", graph[path[i]]?.line ?? "");
    const after = edgeLine(graph[path[i]]?.line ?? "", graph[path[i + 1]]?.line ?? "");
    if (before && after && before !== after) out.push(i);
  }
  return out;
}

/** Stops to wake the rider for: every interchange and the destination. */
export function alarmStops(path: string[], graph: Graph): number[] {
  return [...interchangeStops(path, graph), path.length - 1];
}

/** Rough travel time per hop in ms (~32 km/h with dwell time), used when GPS drops underground. */
export function hopDurationsMs(path: string[], graph: Graph): number[] {
  const out: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const km = graph[path[i]]?.neighbors[path[i + 1]] ?? 1.2;
    out.push(Math.max(75_000, km * 1.9 * 60_000));
  }
  return out;
}

/** Moves `progress` forward by `elapsedMs` using hop durations. */
export function advanceByTime(progress: number, elapsedMs: number, hops: number[]): number {
  let p = progress;
  let left = elapsedMs;
  while (left > 0 && p < hops.length) {
    const i = Math.floor(p);
    const remainingHop = (1 - (p - i)) * hops[i];
    if (left >= remainingHop) {
      p = i + 1;
      left -= remainingHop;
    } else {
      p += left / hops[i];
      left = 0;
    }
  }
  return Math.min(p, hops.length);
}

export interface JourneyView {
  /** Last stop reached (index). */
  atIndex: number;
  /** True when the train is at (or within ~15% of a hop of) `atIndex`'s stop. */
  atStation: boolean;
  nextIndex: number | null;
  stopsLeft: number;
}

export function journeyView(progress: number, total: number): JourneyView {
  const last = total - 1;
  const nearest = Math.round(progress);
  const atStation = Math.abs(progress - nearest) < 0.15;
  const atIndex = atStation ? nearest : Math.floor(progress);
  const nextIndex = atIndex < last ? atIndex + 1 : null;
  return { atIndex, atStation, nextIndex, stopsLeft: Math.max(0, last - atIndex) };
}

/**
 * Which alarm stop needs a warning now: the rider has reached the stop
 * just before it (or is past it), and it has not been announced yet.
 */
export function dueAlarm(progress: number, alarms: number[], announced: Set<number>): number | null {
  for (const stop of alarms) {
    if (!announced.has(stop) && progress >= stop - 1 - 0.15) return stop;
  }
  return null;
}
