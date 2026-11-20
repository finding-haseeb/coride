import prisma from "../config/db.js";
import { PUBLIC_USER_SELECT } from "../utils/publicUser.js";

export const getAllTrips = async () => {
  return await prisma.trip.findMany({
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
};

export const getTripById = async (id) => {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
  if (!trip) throw new Error("Trip not found");
  return trip;
};

export const validateTripInput = (data) => {
  const stationList = Array.isArray(data.stationList) ? data.stationList.map(Number) : null;
  if (!stationList || stationList.length < 2 || stationList.some((n) => !Number.isInteger(n))) {
    throw new Error("stationList must be at least 2 station IDs");
  }
  const distanceKm = data.distanceKm !== undefined && data.distanceKm !== null ? Number(data.distanceKm) : null;
  return {
    stationList,
    length: stationList.length,
    startStation: stationList[0],
    endStation: stationList[stationList.length - 1],
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
  };
};

// The owner always comes from the verified token, never from the request body.
export const createTrip = async (userId, data) => {
  const startTime = new Date(data.startTime);
  if (isNaN(startTime.getTime())) throw new Error("Invalid startTime");
  return await prisma.trip.create({
    data: { userId, startTime, ...validateTripInput(data) },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
};

export const updateTrip = async (id, data) => {
  return await prisma.trip.update({
    where: { id },
    data: {
      ...(data.startTime && { startTime: new Date(data.startTime) }),
      ...(data.stationList !== undefined && { stationList: data.stationList }),
      ...(data.length !== undefined && { length: data.length }),
      ...(data.startStation !== undefined && { startStation: data.startStation }),
      ...(data.endStation !== undefined && { endStation: data.endStation }),
    },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
};

export const deleteTrip = async (id) => {
  await prisma.trip.delete({ where: { id } });
};

export const getTripsByUserId = async (userId) => {
  const trips = await prisma.trip.findMany({
    where: { userId },
    include: { user: { select: PUBLIC_USER_SELECT } },
    orderBy: { startTime: "desc" },
  });
  const history = await prisma.tripHistory.findMany({
    where: { userId },
    include: { user: { select: PUBLIC_USER_SELECT } },
    orderBy: { startTime: "desc" },
  });
  return [...trips, ...history].sort((a, b) => b.startTime - a.startTime);
};

export const getTripsByStation = async (stationId) => {
  return await prisma.trip.findMany({
    where: { OR: [{ startStation: stationId }, { endStation: stationId }, { stationList: { has: stationId } }] },
    include: { user: { select: PUBLIC_USER_SELECT } },
    orderBy: { startTime: "desc" },
  });
};
