// Official Delhi Metro (DMRC) line names and colours, keyed by the `line`
// value used in public/metro_data/metro_data.json.
export interface MetroLine {
  key: string;
  name: string;
  color: string;
}

export const INTERCHANGE_KEY = "black";

export const METRO_LINES: MetroLine[] = [
  { key: "red-400", name: "Red Line", color: "#E21F26" },
  { key: "yellow-400", name: "Yellow Line", color: "#F2B705" },
  { key: "blue-400", name: "Blue Line", color: "#0072BC" },
  { key: "green-400", name: "Green Line", color: "#00A651" },
  { key: "purple-400", name: "Violet Line", color: "#8E3B96" },
  { key: "pink-400", name: "Pink Line", color: "#E8579A" },
  { key: "pink-900", name: "Magenta Line", color: "#A3166C" },
  { key: "gray-400", name: "Grey Line", color: "#8C8F93" },
  { key: "orange-400", name: "Airport Express", color: "#F7931E" },
  { key: "aqua", name: "Aqua Line", color: "#00B5CC" },
  { key: "teal-400", name: "Rapid Metro", color: "#1F8A8A" },
];

const LINE_BY_KEY: Record<string, MetroLine> = Object.fromEntries(
  METRO_LINES.map((l) => [l.key, l]),
);

export const INTERCHANGE_COLOR = "#1F2937";
export const ROUTE_COLOR = "#4F46E5";

export function lineColor(key: string): string {
  if (key === INTERCHANGE_KEY) return INTERCHANGE_COLOR;
  return LINE_BY_KEY[key]?.color ?? "#9CA3AF";
}

export function lineName(key: string): string {
  if (key === INTERCHANGE_KEY) return "Interchange";
  return LINE_BY_KEY[key]?.name ?? "Metro";
}

/**
 * Interchange stations carry the "black" key, so an edge takes the line of
 * whichever endpoint is not an interchange.
 */
export function edgeLine(fromLine: string, toLine: string): string | null {
  if (fromLine !== INTERCHANGE_KEY) return fromLine;
  if (toLine !== INTERCHANGE_KEY) return toLine;
  return null;
}
