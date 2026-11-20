import { Award, BadgeCheck, Flame, Leaf, Lock, MapPinned, Route, Star, Users } from "lucide-react";
import type { RideStats, UserStats } from "../types";

interface StatsCardProps {
  stats: UserStats;
  rideStats: RideStats | null;
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  first_ride: <Route className="size-4" />,
  regular: <Award className="size-4" />,
  century: <MapPinned className="size-4" />,
  explorer: <MapPinned className="size-4" />,
  social: <Users className="size-4" />,
  streak_5: <Flame className="size-4" />,
  trusted: <BadgeCheck className="size-4" />,
  green: <Leaf className="size-4" />,
};

export default function StatsCard({ stats, rideStats }: StatsCardProps) {
  const s = rideStats;
  const items = [
    { label: "Trips", value: (s?.trips ?? stats.totalTrips).toLocaleString(), icon: <Route className="size-4" />, tone: "text-amber-500" },
    { label: "Km ridden", value: s ? s.km.toLocaleString() : "—", icon: <MapPinned className="size-4" />, tone: "text-sky-500" },
    { label: "CO₂ saved", value: s ? `${s.co2Kg} kg` : "—", icon: <Leaf className="size-4" />, tone: "text-emerald-500", title: s?.co2Note },
    { label: "Day streak", value: s ? `${s.streak}` : "—", icon: <Flame className="size-4" />, tone: "text-orange-500", title: s ? `Best: ${s.bestStreak} days` : undefined },
    {
      label: "Rating",
      value: stats.ratingCount ? `${Number(stats.ratings).toFixed(1)}` : "New",
      icon: <Star className="size-4" />,
      tone: "text-yellow-500",
      title: stats.ratingCount ? `${stats.ratingCount} review${stats.ratingCount > 1 ? "s" : ""}` : undefined,
    },
    { label: "Top station", value: stats.favoriteStation === "-" ? "None" : stats.favoriteStation, icon: <MapPinned className="size-4" />, tone: "text-fuchsia-500" },
  ];

  const earned = s?.badges.filter((b) => b.earned).length ?? 0;

  return (
    <div className="space-y-4 font-sans">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} title={item.title} className="glass-panel rounded-2xl bg-background/40 p-4">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${item.tone}`}>
              {item.icon}
              <span className="text-foreground/55">{item.label}</span>
            </div>
            <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {s && (
        <div className="glass-panel rounded-2xl bg-background/40 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-foreground">Badges</h3>
            <span className="text-xs text-foreground/50">
              {earned} of {s.badges.length} earned
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {s.badges.map((b) => (
              <div
                key={b.id}
                title={b.description}
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${
                  b.earned ? "border-primary/30 bg-primary/5" : "border-border opacity-55"
                }`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full ${
                    b.earned ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground/40"
                  }`}
                >
                  {b.earned ? BADGE_ICONS[b.id] ?? <Award className="size-4" /> : <Lock className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">{b.label}</span>
                  <span className="block truncate text-[11px] text-foreground/50">{b.description}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-foreground/40">{s.co2Note}.</p>
        </div>
      )}
    </div>
  );
}
