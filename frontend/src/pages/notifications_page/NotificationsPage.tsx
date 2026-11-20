import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, Check, CheckCheck, Star, Siren, UserPlus, Users, Info } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useNotificationStore, type AppNotification } from "../../store/useNotificationStore";

interface PendingRequest {
  id: string;
  requester: { id: string; name: string; username: string; profile_image?: string | null };
}

const ICONS: Record<string, React.ReactNode> = {
  FRIEND_REQUEST: <UserPlus className="size-4" />,
  FRIEND_ACCEPTED: <Check className="size-4" />,
  REVIEW: <Star className="size-4" />,
  SOS: <Siren className="size-4" />,
  GROUP_INVITE: <Users className="size-4" />,
};

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { items, unread, loaded, refresh, markRead, markAllRead } = useNotificationStore();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const loadRequests = () =>
    api.get("/friendships/pending").then((r) => setRequests(r.data.data)).catch(() => undefined);

  useEffect(() => {
    refresh();
    loadRequests();
  }, [refresh]);

  const respond = async (id: string, accept: boolean) => {
    setError(null);
    try {
      if (accept) await api.put(`/friendships/accept/${id}`);
      else await api.delete(`/friendships/reject/${id}`);
      setRequests((r) => r.filter((x) => x.id !== id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const open = (n: AppNotification) => {
    markRead(n.id);
    if (!n.link) return;
    if (n.link.startsWith("http")) window.open(n.link, "_blank", "noopener");
    else navigate(n.link);
  };

  const enableAlerts = async () => {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-8 md:pt-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-foreground/55">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-foreground/5"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        )}
      </div>

      {permission === "default" && (
        <button
          onClick={enableAlerts}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left"
        >
          <BellRing className="size-5 shrink-0 text-primary" />
          <span className="text-sm">
            <span className="block font-medium text-foreground">Turn on alerts</span>
            <span className="block text-foreground/55">Get a pop-up for requests, messages and SOS while CoRide is in the background.</span>
          </span>
        </button>
      )}

      {error && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}

      {requests.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-foreground/45">
            Ride requests
          </h2>
          <div className="flex flex-col gap-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <button onClick={() => navigate(`/user/${r.requester.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <img
                    src={r.requester.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.requester.name)}&background=random&color=fff`}
                    alt=""
                    className="size-10 rounded-full object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{r.requester.name}</span>
                    <span className="block truncate text-xs text-foreground/50">@{r.requester.username} wants to ride with you</span>
                  </span>
                </button>
                <button onClick={() => respond(r.id, false)} className="h-9 rounded-full border border-border px-3 text-xs font-medium text-foreground/70 hover:bg-foreground/5">
                  Decline
                </button>
                <button onClick={() => respond(r.id, true)} className="h-9 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
                  Accept
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loaded ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-foreground/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Bell className="size-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">No notifications yet</p>
          <p className="text-[13px] text-foreground/55">Requests, reviews and group invites show up here.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition hover:border-primary/40 ${
                  n.type === "SOS"
                    ? "border-rose-500/40 bg-rose-500/5"
                    : n.read
                      ? "border-border bg-card"
                      : "border-primary/25 bg-primary/5"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${
                    n.type === "SOS" ? "bg-rose-500 text-white" : "bg-primary/10 text-primary"
                  }`}
                >
                  {ICONS[n.type] ?? <Info className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{n.title}</span>
                  {n.body && <span className="mt-0.5 block break-words text-[13px] text-foreground/60">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-foreground/40">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
