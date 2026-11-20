import fs from "fs";
import { z } from "zod";
import { askStructured } from "./claude.js";

const STATIONS = Object.keys(JSON.parse(fs.readFileSync(new URL("../data/stations.json", import.meta.url), "utf8")));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const NORMALIZED = STATIONS.map((name) => ({ name, key: norm(name) }));

// Common ways people write station names.
const ALIASES = [
  [/\bsec\b|\bsect\b/g, "sector"],
  [/\bcp\b/g, "rajiv chowk"],
  [/\bconnaught place\b/g, "rajiv chowk"],
  [/\bndls\b/g, "new delhi"],
  [/\bigi airport\b|\bairport\b/g, "igi airport"],
  [/\bhuda city cent(er|re)\b/g, "huda city centre"],
];

const applyAliases = (text) => ALIASES.reduce((t, [re, to]) => t.replace(re, to), text);

/** Best station name for free text, or null. */
export function resolveStation(input) {
  if (!input) return null;
  const q = applyAliases(norm(input));
  const exact = NORMALIZED.find((s) => s.key === q);
  if (exact) return exact.name;
  const contains = NORMALIZED.filter((s) => s.key.includes(q) || q.includes(s.key)).sort(
    (a, b) => Math.abs(a.key.length - q.length) - Math.abs(b.key.length - q.length),
  );
  return contains[0]?.name ?? null;
}

/** Station mentions in order of appearance (longest name wins on overlap). */
function findStations(text) {
  const t = ` ${applyAliases(norm(text))} `;
  const found = [];
  for (const s of NORMALIZED) {
    if (s.key.length < 3) continue;
    const idx = t.indexOf(` ${s.key} `);
    if (idx >= 0) found.push({ name: s.name, idx, len: s.key.length });
  }
  found.sort((a, b) => a.idx - b.idx || b.len - a.len);
  const out = [];
  for (const f of found) {
    const prev = out[out.length - 1];
    if (prev && f.idx < prev.idx + prev.len) continue; // overlapping, shorter
    out.push(f);
  }
  return out;
}

const pad = (n) => String(n).padStart(2, "0");
const localIso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Rule-based parser for English/Hinglish ride requests. `now` is the user's local time. */
export function parseTripRules(text, now = new Date()) {
  const t = norm(text);
  const stations = findStations(text);
  let from = null;
  let to = null;

  // "from X to Y" / "X se Y" / "X to Y"
  if (stations.length >= 2) {
    const [a, b] = stations;
    const between = applyAliases(norm(text)).slice(a.idx, b.idx);
    const reversed = /\bto\b.*\bfrom\b/.test(t) && t.indexOf(" to ") < t.indexOf(" from ");
    [from, to] = reversed ? [b.name, a.name] : [a.name, b.name];
    if (!reversed && !/\b(se|from|to|tak|till)\b/.test(between + " ")) {
      [from, to] = [a.name, b.name];
    }
  } else if (stations.length === 1) {
    const before = t.slice(0, Math.max(0, t.indexOf(norm(stations[0].name))));
    if (/\b(to|tak|jana|jaana)\b\s*$/.test(before) || /\bto\b/.test(before)) to = stations[0].name;
    else from = stations[0].name;
  }

  // Day
  const day = new Date(now);
  if (/\b(parso|day after tomorrow)\b/.test(t)) day.setDate(day.getDate() + 2);
  else if (/\b(kal|tomorrow|tmrw|tmr)\b/.test(t)) day.setDate(day.getDate() + 1);

  // Time
  let departure = null;
  const m = t.match(/\b(\d{1,2})(?:[: ](\d{2}))?\s*(am|pm|baje|bje|o clock)?\b/);
  const hasTimeWord = /\b(subah|morning|shaam|sham|evening|raat|night|dopahar|afternoon|baje|am|pm)\b/.test(t);
  if (m && (m[3] || hasTimeWord) && Number(m[1]) <= 23) {
    let h = Number(m[1]);
    const min = m[2] ? Math.min(59, Number(m[2])) : 0;
    const pm = m[3] === "pm" || /\b(shaam|sham|evening|raat|night)\b/.test(t) || (/\b(dopahar|afternoon)\b/.test(t) && h < 12 && h !== 12);
    const am = m[3] === "am" || /\b(subah|morning)\b/.test(t);
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    // "9 baje" with no hint: assume the next 9 o'clock that is still ahead.
    if (!pm && !am && h < 12 && day.toDateString() === now.toDateString() && h <= now.getHours()) h += 12;
    const d = new Date(day);
    d.setHours(h, min, 0, 0);
    departure = localIso(d);
  } else if (day.toDateString() !== now.toDateString()) {
    const d = new Date(day);
    d.setHours(/\b(shaam|sham|evening)\b/.test(t) ? 18 : 9, 0, 0, 0);
    departure = localIso(d);
  }

  return { from, to, departure };
}

const TripSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  departure: z.string().nullable(),
});

const SYSTEM = `You turn a Delhi Metro rider's message (English, Hindi or Hinglish) into a trip.
Return "from" and "to" as station names copied exactly from the list below, or null if not mentioned.
Return "departure" as local time "YYYY-MM-DDTHH:mm", resolved against the current local time the user gives, or null if no time or day is mentioned.
Hindi hints: "se" = from, "tak" = to, "kal" = tomorrow (in a plan), "parso" = day after tomorrow, "subah" = morning, "shaam" = evening, "raat" = night, "baje" = o'clock.
Stations:
${STATIONS.join("\n")}`;

/**
 * Understands free text with Claude when available, otherwise with rules.
 * Claude only reads the request; routing is still done by the app's Dijkstra.
 */
export async function parseTrip(text, nowLocal) {
  const now = nowLocal ? new Date(nowLocal) : new Date();
  const ai = await askStructured({
    system: SYSTEM,
    prompt: `Current local time: ${localIso(now)} (${now.toLocaleDateString("en-IN", { weekday: "long" })})\nMessage: ${text}`,
    schema: TripSchema,
    maxTokens: 512,
  });
  const rules = parseTripRules(text, now);
  if (ai) {
    // Never trust a station name the model made up.
    const from = resolveStation(ai.from) ?? rules.from;
    const to = resolveStation(ai.to) ?? rules.to;
    const departure = ai.departure && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(ai.departure) ? ai.departure : rules.departure;
    return { from, to, departure, source: "ai" };
  }
  return { ...rules, source: "rules" };
}
