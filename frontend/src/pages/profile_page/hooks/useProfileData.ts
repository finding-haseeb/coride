import { useState, useEffect } from "react";
import { useAuthStore } from "../../../store/useAuthStore";
import { STATIONS_MAP } from "../../../utils/stationsMap";
import { api, errorMessage } from "../../../lib/api";
import type { RideStats } from "../types";

export function useProfileData(targetUserId: string | undefined, isOwnProfile: boolean) {
  const { user, token } = useAuthStore();
  const [rideStats, setRideStats] = useState<RideStats | null>(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    favoriteStation: "-",
    memberSince: "Loading...",
    ratings: 0,
    ratingCount: 0,
  });
  const [fullUser, setFullUser] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (targetUserId) {
      const fetchFullUser = async () => {
        try {
          // Sent with the token so the owner also gets private fields.
          const [res, statsRes] = await Promise.all([
            api.get(`/users/${targetUserId}`),
            api.get(`/stats/${targetUserId}`).catch(() => null),
          ]);
          if (statsRes) setRideStats(statsRes.data.data);
          if (res.data && res.data.data) {
            setFullUser(res.data.data);

            const userTrips = res.data.data.trips || [];
            let totalDistance = 0;
            const stationCounts: Record<string, number> = {};

            userTrips.forEach((trip: any) => {
              totalDistance += trip.length || 0;
              if (trip.stationList) {
                trip.stationList.forEach((station: string) => {
                  stationCounts[station] = (stationCounts[station] || 0) + 1;
                });
              }
            });

            let favorite = "-";
            let maxCount = 0;
            Object.entries(stationCounts).forEach(([station, count]) => {
              if (count > maxCount) {
                maxCount = count;
                favorite = station;
              }
            });

            setStats({
              totalTrips: userTrips.length,
              totalDistance,
              // stationList holds station IDs; show the station's name.
              favoriteStation:
                favorite !== "-" ? STATIONS_MAP[Number(favorite)] ?? "None" : "None",
              memberSince: "",
              ratings: res.data.data.ratings || 0,
              ratingCount: res.data.data.ratingCount || 0,
            });
          }
        } catch (error) {
          console.error("Failed to fetch user full profile", error);
        } finally {
          setLoadingProfile(false);
        }
      };

      fetchFullUser();
    } else {
      setLoadingProfile(false);
      setStats((prev) => ({ ...prev, memberSince: "Not Logged In" }));
    }

    if (isOwnProfile && token) {
      api
        .get("/friendships/pending")
        .then((res) => {
          if (res.data && res.data.data) {
            setPendingRequests(res.data.data);
          }
        })
        .catch((err) => console.error("Failed to fetch pending requests", err));
    }
  }, [targetUserId, refetchTrigger, isOwnProfile, token]);

  const handleAcceptRequest = async (id: string) => {
    try {
      await api.put(`/friendships/accept/${id}`);
      setPendingRequests((prev) => prev.filter((req) => req.id !== id));
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      alert(errorMessage(err, "Failed to accept request."));
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      await api.delete(`/friendships/reject/${id}`);
      setPendingRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to reject request.");
    }
  };

  const handleUpdateGallery = async (newImages: string[]) => {
    try {
      if (!user) return;
      await api.put(`/users/${user.id}`, { images: newImages });
      setFullUser((prev: any) => ({ ...prev, images: newImages }));
    } catch (error) {
      console.error("Failed to update gallery", error);
      alert("Failed to update gallery");
    }
  };

  const handleUploadGalleryImage = async (file: File) => {
    try {
      if (!user) return;
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post(`/users/${user.id}/gallery`, formData);

      if (res.data && res.data.success) {
        setFullUser((prev: any) => ({ ...prev, images: res.data.data.images }));
      }
    } catch (error) {
      alert(errorMessage(error, "Failed to upload gallery image"));
      throw error;
    }
  };

  return {
    stats,
    rideStats,
    fullUser,
    loadingProfile,
    pendingRequests,
    setRefetchTrigger,
    handleAcceptRequest,
    handleRejectRequest,
    handleUpdateGallery,
    handleUploadGalleryImage,
  };
}
