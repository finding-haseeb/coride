import prisma from "../config/db.js";

// Average distance between two neighbouring Delhi Metro stations, used when an
// older trip was saved without its distance.
const AVG_KM_PER_HOP = 1.15;
// Rough saving of a metro km over driving a petrol car alone (kg CO2 per km).
// This is an estimate for motivation, not a measured value.
export const CO2_KG_PER_KM = 0.14;
const IST_OFFSET_MS = 330 * 60000;

const istDayKey = (date) => new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Days in a row with at least one trip, ending today or yesterday (India time). */
export const currentStreak = (dates, now = new Date()) => {
  const days = new Set(dates.map(istDayKey));
  const dayMs = 24 * 60 * 60 * 1000;
  let cursor = now.getTime();
  if (!days.has(istDayKey(cursor))) cursor -= dayMs;
  let streak = 0;
  while (days.has(istDayKey(cursor))) {
    streak++;
    cursor -= dayMs;
  }
  return streak;
};

export const BADGES = [
  { id: "first_ride", label: "First ride", description: "Plan your first trip", test: (s) => s.trips >= 1 },
  { id: "regular", label: "Regular", description: "Plan 10 trips", test: (s) => s.trips >= 10 },
  { id: "century", label: "Century", description: "Ride 100 km", test: (s) => s.km >= 100 },
  { id: "explorer", label: "Explorer", description: "Visit 25 different stations", test: (s) => s.stations >= 25 },
  { id: "social", label: "Social rider", description: "Make 3 CoRide friends", test: (s) => s.friends >= 3 },
  { id: "streak_5", label: "On a roll", description: "Trips on 5 days in a row", test: (s) => s.bestStreak >= 5 },
  { id: "trusted", label: "Trusted", description: "Verify your email", test: (s) => s.verified },
  { id: "green", label: "Green commuter", description: "Save 10 kg of CO₂", test: (s) => s.co2Kg >= 10 },
];

const longestStreak = (dates) => {
  const keys = [...new Set(dates.map(istDayKey))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    const t = Date.parse(k);
    run = prev !== null && t - prev === 24 * 60 * 60 * 1000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
};

export const getStats = async (userId) => {
  const [user, trips, history, friends] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true, ratings: true, ratingCount: true } }),
    prisma.trip.findMany({ where: { userId }, select: { startTime: true, stationList: true, distanceKm: true } }),
    prisma.tripHistory.findMany({ where: { userId }, select: { startTime: true, stationList: true, distanceKm: true } }),
    prisma.friendship.count({ where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { receiverId: userId }] } }),
  ]);
  if (!user) throw new Error("User not found");

  const all = [...trips, ...history];
  const km = all.reduce((sum, t) => sum + (t.distanceKm ?? Math.max(0, t.stationList.length - 1) * AVG_KM_PER_HOP), 0);
  const stations = new Set(all.flatMap((t) => t.stationList)).size;
  const dates = all.map((t) => t.startTime);

  const summary = {
    trips: all.length,
    km: Math.round(km * 10) / 10,
    stations,
    friends,
    co2Kg: Math.round(km * CO2_KG_PER_KM * 10) / 10,
    streak: currentStreak(dates),
    bestStreak: longestStreak(dates),
    verified: user.emailVerified,
    rating: user.ratings,
    ratingCount: user.ratingCount,
  };
  const badges = BADGES.map(({ test, ...b }) => ({ ...b, earned: test(summary) }));
  return { ...summary, badges, co2Note: `Estimate: ${CO2_KG_PER_KM} kg CO₂ saved per km vs driving alone` };
};
