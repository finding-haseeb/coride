import { z } from "zod";
import prisma from "../config/db.js";
import { askStructured } from "./claude.js";
import fs from "fs";

const ID_TO_NAME = Object.fromEntries(
  Object.entries(JSON.parse(fs.readFileSync(new URL("../data/stations.json", import.meta.url), "utf8"))).map(([n, id]) => [id, n]),
);

const Schema = z.object({ suggestions: z.array(z.string()) });

const SYSTEM = `You write opening chat lines for two Delhi Metro commuters who just matched on CoRide to ride together.
Write 3 short, friendly, respectful first messages (max 15 words each), in casual English that may mix in simple Hindi.
Use the shared route or interests when given. No flirting, no personal questions about looks, address or relationships.`;

const recentStations = async (userId) => {
  const trips = await prisma.trip.findMany({ where: { userId }, orderBy: { startTime: "desc" }, take: 5, select: { stationList: true } });
  return new Set(trips.flatMap((t) => t.stationList));
};

/** 3 opening lines based on common interests and shared stations. */
export async function getIcebreakers(meId, otherId) {
  const [me, other, mine, theirs] = await Promise.all([
    prisma.user.findUnique({ where: { id: meId }, select: { name: true, interests: true } }),
    prisma.user.findUnique({ where: { id: otherId }, select: { name: true, interests: true } }),
    recentStations(meId),
    recentStations(otherId),
  ]);
  if (!me || !other) throw new Error("User not found");

  const common = me.interests.filter((i) => other.interests.includes(i));
  const shared = [...mine].filter((s) => theirs.has(s)).map((id) => ID_TO_NAME[id]).filter(Boolean);
  const first = other.name.split(" ")[0];

  const ai = await askStructured({
    system: SYSTEM,
    prompt: [
      `Other person's first name: ${first}`,
      `Shared stations on recent trips: ${shared.slice(0, 6).join(", ") || "unknown"}`,
      `Interests in common: ${common.join(", ") || "none known"}`,
      `Their interests: ${other.interests.join(", ") || "unknown"}`,
    ].join("\n"),
    schema: Schema,
    maxTokens: 400,
  });
  const fromAi = ai?.suggestions?.map((s) => s.trim()).filter((s) => s && s.length <= 140).slice(0, 3);
  if (fromAi?.length) return { suggestions: fromAi, common, source: "ai" };

  const lines = [];
  if (shared.length) lines.push(`Hi ${first}! Looks like we both pass ${shared[0]}. Which coach do you usually take?`);
  if (common.length) lines.push(`Hey ${first}, I see you're into ${common[0]} too 🙂`);
  lines.push(`Hi ${first}! What time do you usually start your ride?`);
  lines.push(`Hey ${first}, want to meet at the platform and ride together?`);
  return { suggestions: lines.slice(0, 3), common, source: "rules" };
}
