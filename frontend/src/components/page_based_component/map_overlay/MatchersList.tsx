import { Star, ChevronLeft, ChevronRight, UserPlus, Check, Clock3, Route, MessageCircle, BadgeCheck, Repeat } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface MatchersListProps {
  hasSearched: boolean;
  matchers: any[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onAddFriend: (e: React.MouseEvent, receiverId: string) => void;
}

export function MatchersList({
  hasSearched,
  matchers,
  page,
  totalPages,
  onPageChange,
  onAddFriend,
}: MatchersListProps) {
  const navigate = useNavigate();

  if (!hasSearched) {
    return (
      <EmptyState
        icon={<Route className="size-5" />}
        title="Your co-riders show up here"
        body="Choose a start and end station, then tap Find co-riders."
      />
    );
  }

  // A trip with no shared station is not a real match.
  const visible = matchers.filter((m) => (m.lcsLen ?? 0) > 0);

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={<Clock3 className="size-5" />}
        title="No co-riders on this route yet"
        body="Nobody rides this way within 20 minutes of your time. Try another time, loosen filters, or save your trip so others can find you."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-foreground/45">
        {visible.length} co-rider{visible.length > 1 ? "s" : ""} found
      </p>
      {visible.map((match) => (
        <div
          key={match.id}
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/user/${match.user.id}`)}
          onKeyDown={(e) => e.key === "Enter" && navigate(`/user/${match.user.id}`)}
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-md"
        >
          {match.user.profile_image ? (
            <img
              src={match.user.profile_image}
              alt=""
              className="size-11 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-fuchsia-500/80 text-base font-semibold text-white">
              {match.user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{match.user.name}</span>
              {match.user.emailVerified && (
                <BadgeCheck className="size-3.5 shrink-0 text-sky-500" aria-label="Verified" />
              )}
              {Number(match.user.ratings) > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-amber-500">
                  <Star className="size-3 fill-current" />
                  {Number(match.user.ratings).toFixed(1)}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground/55">
              <span>
                {match.lcsLen} shared station{match.lcsLen > 1 ? "s" : ""}
              </span>
              {match.startTime && (
                <>
                  <span className="text-foreground/25">•</span>
                  <span>
                    {new Date(match.startTime).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </>
              )}
              {match.kind === "recurring" && (
                <span className="inline-flex items-center gap-0.5 text-primary">
                  <Repeat className="size-3" /> weekly
                </span>
              )}
            </div>
            {match.commonInterests?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {match.commonInterests.slice(0, 3).map((i: string) => (
                  <span key={i} className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] text-primary">
                    {i}
                  </span>
                ))}
              </div>
            )}
            {typeof match.timeDiffAtOverlap === "number" && (
              <div className="mt-0.5 text-[11px] text-foreground/45">
                {match.timeDiffAtOverlap === 0
                  ? "Same train time"
                  : `${Math.abs(match.timeDiffAtOverlap)} min ${match.timeDiffAtOverlap > 0 ? "after" : "before"} you`}
              </div>
            )}
          </div>
          {typeof match.score === "number" && (
            <div
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold tabular-nums"
              style={{ borderColor: scoreColor(match.score), color: scoreColor(match.score) }}
              title="Compatibility: shared route, timing, common interests, rating and how often they accept requests"
            >
              {match.score}
            </div>
          )}

          {match.friendshipStatus === "NONE" && (
            <button
              onClick={(e) => onAddFriend(e, match.user.id)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
            >
              <UserPlus className="size-3.5" /> Connect
            </button>
          )}
          {match.friendshipStatus === "SENT_REQUEST" && (
            <span className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground/50">
              Requested
            </span>
          )}
          {match.friendshipStatus === "RECEIVED_REQUEST" && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Respond
            </span>
          )}
          {match.friendshipStatus === "ACCEPTED" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/chat/${match.user.id}`);
              }}
              className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              <Check className="size-3.5" />
              <MessageCircle className="size-3.5" />
            </button>
          )}
        </div>
      ))}

      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-card p-1.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="grid size-8 place-items-center rounded-lg text-foreground/60 hover:bg-foreground/5 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs text-foreground/50">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="grid size-8 place-items-center rounded-lg text-foreground/60 hover:bg-foreground/5 disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 75) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#94A3B8";
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-foreground/55">{body}</p>
      </div>
    </div>
  );
}
