export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  emailVerified?: Date | null;
  password?: string | null;
  image?: string | null;
  about?: string | null;
  bio?: string | null;
  mfaEnabled: boolean;
  mfaTotpSecret?: string | null;
  mfaBackupCodes: string[];
}

export interface Trip {
  id: string;
  userId: string;
  startTime: Date;
  stationList: string[];
  length: number;
  startStation: string;
  endStation: string;
}

export interface UserStats {
  totalTrips: number;
  totalDistance: number;
  favoriteStation: string;
  memberSince: string;
  ratings?: number;
  ratingCount?: number;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  earned: boolean;
}

/** From GET /api/stats/:userId */
export interface RideStats {
  trips: number;
  km: number;
  stations: number;
  friends: number;
  co2Kg: number;
  streak: number;
  bestStreak: number;
  verified: boolean;
  rating: number;
  ratingCount: number;
  badges: Badge[];
  co2Note: string;
}
