import { ExternalLink, MapPin, ShieldAlert } from "lucide-react";
import type { Message } from "../types";
import { looksRisky, parseMeetup, stationMapsUrl } from "../../../utils/metroInfo";

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  avatar?: string;
  senderName?: string;
};

export default function MessageBubble({
  message,
  isOwn,
  showAvatar = false,
  avatar,
  senderName,
}: MessageBubbleProps) {
  const meetup = parseMeetup(message.content);
  const risky = !isOwn && (!!message.flag || looksRisky(message.content));
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className={`flex items-end mb-4 animate-fade-in font-sans ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      {!isOwn && (
        <div className="w-8 mr-2 flex-shrink-0">
          {showAvatar && (
            <img
              src={avatar}
              alt="Avatar"
              className="w-8 h-8 rounded-[var(--radius-pill)] bg-card object-cover border border-border"
            />
          )}
        </div>
      )}

      <div
        className={`max-w-xs lg:max-w-md xl:max-w-lg ${
          isOwn ? "order-1" : "order-2"
        }`}
      >
        {senderName && !isOwn && showAvatar && (
          <p className="mb-1 ml-3 text-[11px] font-medium text-foreground/55">{senderName}</p>
        )}
        {meetup ? (
          <a
            href={stationMapsUrl(meetup.station)}
            target="_blank"
            rel="noreferrer"
            className={`flex min-w-[220px] items-center gap-3 rounded-2xl border p-3 shadow-sm transition hover:brightness-105 ${
              isOwn ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
            }`}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${isOwn ? "bg-white/20" : "bg-primary/10 text-primary"}`}>
              <MapPin className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-wide opacity-70">Meeting point</span>
              <span className="block truncate text-sm font-semibold">{meetup.station}</span>
              {meetup.note && <span className="block truncate text-xs opacity-80">{meetup.note}</span>}
            </span>
            <ExternalLink className="size-4 shrink-0 opacity-60" />
          </a>
        ) : (
        <div
          className={`px-4 py-2.5 rounded-3xl shadow-sm ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-sm border border-primary"
              : "bg-card text-foreground rounded-bl-sm border border-border"
          } ${message.content.startsWith("[Image: ") ? "p-1.5" : ""}`}
        >
          {message.content.startsWith("[Image: ") &&
          message.content.endsWith("]") ? (
            <img
              src={message.content.replace("[Image: ", "").slice(0, -1)}
              alt="Uploaded content"
              className="max-w-full rounded-2xl max-h-64 object-cover"
            />
          ) : (
            <p className="font-body-sm break-words leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>
        )}
        {risky && (
          <p className="mt-1 flex items-start gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
            <ShieldAlert className="mt-px size-3.5 shrink-0" />
            Be careful: never share an OTP or UPI PIN, or pay anyone you met on CoRide.
          </p>
        )}
        <div
          className={`flex items-center mt-1 space-x-1 ${
            isOwn ? "justify-end" : "justify-start"
          }`}
        >
          <span className="font-eyebrow text-[10px] text-foreground/50 lowercase">
            {formatTime(message.timestamp)}
          </span>
          {isOwn && (
            <span
              className="flex items-center text-primary/80"
              title={message.status === "read" ? "Read" : message.status === "delivered" ? "Delivered" : "Sending"}
            >
              {message.status === "read" && (
                <svg
                  className="w-3.5 h-3.5 text-sky-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  <path d="M12.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-1-1a1 1 0 011.414-1.414l.293.293 7.293-7.293a1 1 0 011.414 0z" />
                </svg>
              )}
              {message.status === "delivered" && (
                <svg
                  className="w-3.5 h-3.5 text-foreground/30"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  <path d="M12.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-1-1a1 1 0 011.414-1.414l.293.293 7.293-7.293a1 1 0 011.414 0z" />
                </svg>
              )}
              {message.status === "sent" && (
                <svg
                  className="w-3.5 h-3.5 text-foreground/30"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                </svg>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
