import prisma from "../config/db.js";
import { PUBLIC_USER_SELECT } from "../utils/publicUser.js";
import { getHiddenUserIds } from "./blockService.js";

const TIME_WINDOW_MINUTES = 120;
const AVG_STATION_TIME_MINUTES = 3;
const DEFAULT_MATCH_THRESHOLD_MINUTES = 10;
// One shared station is just crossing paths; two in a row means riding together
// in the same direction for at least one stretch.
const DEFAULT_MIN_OVERLAP = 2;
const IST_OFFSET_MINUTES = 330;

function getLongestCommonWithIndices(st, candidateIds) {
  let v = 0, l = 0, bestLen = 0, bestEndPosRef = -1, bestEndPosCand = -1;
  for (let i = 0; i < candidateIds.length; i++) {
    const c = candidateIds[i];
    while (v !== -1 && !st[v].next.has(c)) {
      v = st[v].link;
      if (v !== -1) l = st[v].len;
    }
    if (v === -1) { v = 0; l = 0; } else { v = st[v].next.get(c); l++; }
    if (l > bestLen) { bestLen = l; bestEndPosRef = st[v].firstEndPos; bestEndPosCand = i; }
  }
  const startRef = bestEndPosRef !== -1 ? bestEndPosRef - bestLen + 1 : -1;
  const startCand = bestEndPosCand !== -1 ? bestEndPosCand - bestLen + 1 : -1;
  return { length: bestLen, startRef, startCand };
}

function deserializeSam(serializedSam) {
  if (!serializedSam || !serializedSam.st) return null;
  return serializedSam.st.map(state => ({ ...state, next: new Map(state.next) }));
}

/** Day of week (0 = Sunday) and minutes after midnight in India time. */
export function istParts(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60000);
  return { day: shifted.getUTCDay(), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

/** The UTC instant of `minutes` (India time) on the same India-date as `date`. */
export function istDateAt(date, minutes) {
  const { minutes: nowMinutes } = istParts(date);
  return new Date(date.getTime() + (minutes - nowMinutes) * 60000 - date.getUTCSeconds() * 1000 - date.getUTCMilliseconds());
}

export const SCORE_WEIGHTS = { overlap: 45, time: 25, interests: 15, rating: 10, responsive: 5 };

/** Share of interest tags two people have in common (Jaccard, 0-1). */
export function interestSimilarity(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const common = b.filter((x) => A.has(x)).length;
  return common / new Set([...a, ...b]).size;
}

/**
 * 0-100 compatibility. Shared route matters most, then timing, common
 * interests, rating, and how often the person accepts ride requests
 * (learned from past requests, so the ranking improves with use).
 */
export function matchScore({ overlap, queryLength, timeDiff, threshold, rating, ratingCount, interests = 0, acceptRate = null }) {
  const parts = {
    overlap: queryLength > 0 ? Math.min(1, overlap / queryLength) : 0,
    time: timeDiff === null ? 0.5 : Math.max(0, 1 - Math.abs(timeDiff) / Math.max(threshold, 1)),
    interests,
    rating: ratingCount > 0 ? Math.min(1, rating / 5) : 0.6,
    responsive: acceptRate === null ? 0.5 : acceptRate,
  };
  return Math.round(Object.entries(SCORE_WEIGHTS).reduce((sum, [k, w]) => sum + parts[k] * w, 0));
}

/** Accepted / received ride requests per user; null for fewer than 3 requests. */
async function acceptRates(userIds) {
  if (!userIds.length) return new Map();
  const rows = await prisma.friendship.groupBy({
    by: ["receiverId", "status"],
    where: { receiverId: { in: userIds } },
    _count: { _all: true },
  });
  const totals = new Map();
  for (const r of rows) {
    const t = totals.get(r.receiverId) || { all: 0, ok: 0 };
    t.all += r._count._all;
    if (r.status === "ACCEPTED") t.ok += r._count._all;
    totals.set(r.receiverId, t);
  }
  return new Map([...totals].map(([id, t]) => [id, t.all >= 3 ? t.ok / t.all : null]));
}

function passesFilters(candidate, filters) {
  if (!filters) return true;
  if (filters.womenOnly && candidate.gender !== "female") return false;
  if (filters.verifiedOnly && !candidate.emailVerified) return false;
  const ageMin = Number(filters.ageMin) || null;
  const ageMax = Number(filters.ageMax) || null;
  if (ageMin || ageMax) {
    if (!candidate.birthYear) return false;
    const age = new Date().getFullYear() - candidate.birthYear;
    if (ageMin && age < ageMin) return false;
    if (ageMax && age > ageMax) return false;
  }
  return true;
}

function friendshipFor(user, otherId, friendships) {
  if (!user) return { friendshipStatus: "NONE", friendshipId: null };
  const f = friendships.find(
    (x) => (x.requesterId === otherId && x.receiverId === user.id) || (x.receiverId === otherId && x.requesterId === user.id),
  );
  if (!f) return { friendshipStatus: "NONE", friendshipId: null };
  let friendshipStatus = f.status;
  if (f.status === "PENDING") friendshipStatus = f.receiverId === user.id ? "RECEIVED_REQUEST" : "SENT_REQUEST";
  return { friendshipStatus, friendshipId: f.id };
}

export const matchTrips = async (user, data) => {
  const { sam, startTime, totalStations, matchThreshold, filters, minOverlap } = data;
  const thresholdMinutes = matchThreshold !== undefined ? parseInt(matchThreshold) : DEFAULT_MATCH_THRESHOLD_MINUTES;
  const needOverlap = Math.max(1, parseInt(minOverlap) || DEFAULT_MIN_OVERLAP);
  const st = deserializeSam(sam);
  if (!st) throw new Error("Failed to deserialize SAM");
  const queryLength = parseInt(totalStations) || Math.max(...st.map((s) => s.len));

  let refTime = null;
  const tripWhere = {};
  if (startTime) {
    refTime = new Date(startTime);
    if (isNaN(refTime.getTime())) throw new Error("Invalid startTime");
    tripWhere.startTime = {
      gte: new Date(refTime.getTime() - TIME_WINDOW_MINUTES * 60000),
      lte: new Date(refTime.getTime() + TIME_WINDOW_MINUTES * 60000),
    };
  }

  const excluded = user ? [user.id, ...(await getHiddenUserIds(user.id))] : [];
  if (excluded.length) tripWhere.userId = { notIn: excluded };

  const recurringWhere = { active: true, ...(excluded.length && { userId: { notIn: excluded } }) };
  if (refTime) recurringWhere.days = { has: istParts(refTime).day };

  const [trips, recurring, friendships, me] = await Promise.all([
    prisma.trip.findMany({ where: tripWhere, include: { user: { select: PUBLIC_USER_SELECT } } }),
    prisma.recurringTrip.findMany({ where: recurringWhere, include: { user: { select: PUBLIC_USER_SELECT } } }),
    user
      ? prisma.friendship.findMany({ where: { OR: [{ requesterId: user.id }, { receiverId: user.id }] } })
      : Promise.resolve([]),
    user ? prisma.user.findUnique({ where: { id: user.id }, select: { interests: true } }) : Promise.resolve(null),
  ]);
  const myInterests = me?.interests ?? [];
  const rates = await acceptRates([...new Set([...trips, ...recurring].map((t) => t.userId))]);

  // Recurring trips behave like a trip on the searched day at their usual time.
  const candidates = [
    ...trips.map((t) => ({ ...t, kind: "trip" })),
    ...recurring.map((r) => ({
      id: r.id,
      userId: r.userId,
      user: r.user,
      stationList: r.stationList,
      length: r.length,
      startStation: r.startStation,
      endStation: r.endStation,
      distanceKm: r.distanceKm,
      startTime: refTime ? istDateAt(refTime, r.departureMinutes) : null,
      kind: "recurring",
      recurring: { days: r.days, departureMinutes: r.departureMinutes },
    })),
  ];

  const results = [];
  for (const trip of candidates) {
    if (!passesFilters(trip.user, filters)) continue;
    const { length, startRef, startCand } = getLongestCommonWithIndices(st, trip.stationList);
    if (length < needOverlap) continue;

    let timeDiffAtOverlap = null;
    if (refTime && trip.startTime) {
      const overlapTimeRef = refTime.getTime() + startRef * AVG_STATION_TIME_MINUTES * 60000;
      const overlapTimeCan = new Date(trip.startTime).getTime() + startCand * AVG_STATION_TIME_MINUTES * 60000;
      timeDiffAtOverlap = Math.round((overlapTimeCan - overlapTimeRef) / 60000);
      if (Math.abs(timeDiffAtOverlap) > thresholdMinutes) continue;
    }

    results.push({
      ...trip,
      lcsLen: length,
      startInQuery: startRef,
      startInCandidate: startCand,
      timeDiffAtOverlap,
      isViable: true,
      score: matchScore({
        overlap: length,
        queryLength,
        timeDiff: timeDiffAtOverlap,
        threshold: thresholdMinutes,
        rating: trip.user.ratings,
        ratingCount: trip.user.ratingCount,
        interests: interestSimilarity(myInterests, trip.user.interests),
        acceptRate: rates.get(trip.user.id) ?? null,
      }),
      commonInterests: (trip.user.interests || []).filter((i) => myInterests.includes(i)),
      ...friendshipFor(user, trip.user.id, friendships),
    });
  }

  // Show each person once, with their best matching trip.
  const best = new Map();
  for (const r of results) {
    const prev = best.get(r.user.id);
    if (!prev || r.score > prev.score) best.set(r.user.id, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || b.lcsLen - a.lcsLen);
};
