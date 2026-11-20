import type { Graph } from "../../../pages/map_page/types";
import { edgeLine } from "../../../pages/map_page/metroLines";

export interface RouteSummary {
  stops: number;
  distanceKm: number;
  minutes: number;
  interchanges: number;
  lines: string[];
}

const MIN_PER_KM = 1.9; // ~32 km/h average metro speed incl. dwell time
const MIN_PER_INTERCHANGE = 5;

export function summarizeRoute(path: string[], graph: Graph): RouteSummary | null {
  if (path.length < 2) return null;
  let distanceKm = 0;
  const lines: string[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = graph[path[i]];
    const b = graph[path[i + 1]];
    if (!a || !b) continue;
    distanceKm += a.neighbors[path[i + 1]] ?? 0;
    const line = edgeLine(a.line, b.line);
    if (line && lines[lines.length - 1] !== line) lines.push(line);
  }
  const interchanges = Math.max(0, lines.length - 1);
  return {
    stops: path.length - 1,
    distanceKm: Math.round(distanceKm * 10) / 10,
    minutes: Math.round(distanceKm * MIN_PER_KM + interchanges * MIN_PER_INTERCHANGE),
    interchanges,
    lines,
  };
}
