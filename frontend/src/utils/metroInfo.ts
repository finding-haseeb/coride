// Rider information for a Delhi Metro route. Fares follow the DMRC fare table
// revised in August 2025; train gaps and crowding are typical patterns, not
// live data, and the UI labels them as estimates.

export interface FareInfo {
  fare: number;
  smartCard: number;
  reducedDay: boolean;
}

// [upper km limit, normal-day fare, Sunday/holiday fare]
const FARE_SLABS: [number, number, number][] = [
  [2, 11, 11],
  [5, 21, 11],
  [12, 32, 21],
  [21, 43, 32],
  [32, 54, 43],
  [Infinity, 64, 54],
];

/** National holidays with Sunday fares (month-day). */
const NATIONAL_HOLIDAYS = ["01-26", "08-15", "10-02"];

export function isReducedFareDay(date: Date): boolean {
  const md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return date.getDay() === 0 || NATIONAL_HOLIDAYS.includes(md);
}

export function estimateFare(distanceKm: number, date: Date = new Date()): FareInfo {
  const reducedDay = isReducedFareDay(date);
  const slab = FARE_SLABS.find(([limit]) => distanceKm <= limit) ?? FARE_SLABS[FARE_SLABS.length - 1];
  const fare = reducedDay ? slab[2] : slab[1];
  // Smart card / QR tickets get 10% off.
  return { fare, smartCard: Math.round(fare * 0.9), reducedDay };
}

export type Period = "peak" | "day" | "evening" | "night" | "closed";

/** Weekday rush hours are 8-11 am and 5-8 pm. */
export function servicePeriod(date: Date): Period {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 5.5 || h >= 23.5) return "closed";
  const weekday = date.getDay() !== 0 && date.getDay() !== 6;
  if (weekday && ((h >= 8 && h < 11) || (h >= 17 && h < 20))) return "peak";
  if (h >= 21.5) return "night";
  if (h >= 20) return "evening";
  return "day";
}

// Typical gap between trains in minutes: [peak, day, evening, night].
const HEADWAYS: Record<string, [number, number, number, number]> = {
  "yellow-400": [2, 4, 5, 10],
  "blue-400": [2.5, 4, 5, 10],
  "red-400": [3, 5, 6, 10],
  "green-400": [4, 6, 8, 12],
  "purple-400": [3, 5, 6, 10],
  "pink-400": [3.5, 6, 7, 12],
  "pink-900": [3.5, 6, 7, 12],
  "gray-400": [6, 8, 10, 15],
  "orange-400": [10, 15, 15, 20],
  aqua: [6, 10, 10, 15],
  "teal-400": [4, 6, 8, 12],
};

/** Longest typical wait on any line of the route, in minutes (null when closed). */
export function typicalWait(lines: string[], date: Date = new Date()): number | null {
  const period = servicePeriod(date);
  if (period === "closed") return null;
  const index = { peak: 0, day: 1, evening: 2, night: 3 }[period];
  const gaps = lines.map((l) => (HEADWAYS[l] ?? [4, 6, 8, 12])[index]);
  return gaps.length ? Math.max(...gaps) : null;
}

export type CrowdLevel = "Low" | "Moderate" | "High" | "Very high";

const BUSY_STATIONS = new Set([
  "Rajiv Chowk",
  "Kashmere Gate",
  "Central Secretariat",
  "Hauz Khas",
  "Mandi House",
  "Kirti Nagar",
  "Yamuna Bank",
  "Botanical Garden",
  "Welcome",
  "Huda City Centre",
  "New Delhi",
  "Chandni Chowk",
  "Anand Vihar",
  "Lajpat Nagar",
]);

/** A rough crowd guess from time of day and busy interchanges on the route. */
export function estimateCrowd(path: string[], date: Date = new Date()): CrowdLevel | null {
  const period = servicePeriod(date);
  if (period === "closed") return null;
  const busyStops = path.filter((s) => BUSY_STATIONS.has(s)).length;
  let score = { peak: 2, day: 1, evening: 1, night: 0 }[period];
  if (date.getDay() === 0) score -= 1;
  if (busyStops >= 2) score += 1;
  const levels: CrowdLevel[] = ["Low", "Moderate", "High", "Very high"];
  return levels[Math.max(0, Math.min(levels.length - 1, score))];
}

export function stationMapsUrl(station: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station} metro station, Delhi`)}`;
}

export function mapsUrlFor(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Meeting-point messages look like "📍 Meet at Rajiv Chowk · Gate 4". */
export const MEETUP_PREFIX = "📍 Meet at ";

export function meetupMessage(station: string, note?: string): string {
  const extra = note?.trim();
  return `${MEETUP_PREFIX}${station}${extra ? ` · ${extra}` : ""}`;
}

export function parseMeetup(text: string): { station: string; note: string | null } | null {
  if (!text.startsWith(MEETUP_PREFIX)) return null;
  const [station, ...rest] = text.slice(MEETUP_PREFIX.length).split(" · ");
  return station ? { station, note: rest.join(" · ") || null } : null;
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${suffix}`;
}

const CROWD_RANK: Record<CrowdLevel, number> = { Low: 0, Moderate: 1, High: 2, "Very high": 3 };

/**
 * Looks 15-30 minutes either side of `date` for a departure with a lower
 * estimated crowd. Returns null when the chosen time is already the best nearby.
 */
export function lessCrowdedTime(path: string[], date: Date): { date: Date; level: CrowdLevel; diffMin: number } | null {
  const current = estimateCrowd(path, date);
  if (!current) return null;
  let best: { date: Date; level: CrowdLevel; diffMin: number } | null = null;
  for (const diffMin of [-15, 15, -30, 30]) {
    const d = new Date(date.getTime() + diffMin * 60000);
    const level = estimateCrowd(path, d);
    if (!level || CROWD_RANK[level] >= CROWD_RANK[current]) continue;
    if (!best || CROWD_RANK[level] < CROWD_RANK[best.level]) best = { date: d, level, diffMin };
  }
  return best;
}

const RISKY = /\b(otp|upi pin|cvv|kyc|lottery|send money|paise bhejo|advance payment)\b|\b(bit\.ly|tinyurl\.com|cutt\.ly|rb\.gy|t\.me)\//i;

/** Words and links often used in scams; used to warn the reader. */
export function looksRisky(text: string): boolean {
  return RISKY.test(text);
}
