import axios from "axios";
import Cookies from "js-cookie";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
export const CHAT_WORKER_URL = import.meta.env.VITE_CHAT_WORKER_URL || "http://localhost:4002/api";
export const SOCKET_URL = import.meta.env.VITE_CHAT_GATEWAY_URL || "http://localhost:4001";

/** Axios client for the main API that sends the saved login token. */
export const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Pulls a readable message out of an API error. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || (err.response ? fallback : "Can't reach the server");
  }
  return fallback;
}

export function avatarFor(user: { name?: string; username?: string; profile_image?: string | null }) {
  return (
    user.profile_image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username || "User")}&background=random&color=fff`
  );
}
