import { useState } from "react";
import { MapPin, Navigation, X } from "lucide-react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ReportDialog from "./ReportDialog";
import type { User, Message, Group, LiveLocation } from "../types";
import { avatarFor } from "../../../lib/api";
import { mapsUrlFor } from "../../../utils/metroInfo";

type ChatWindowProps = {
  user: User | null;
  group: Group | null;
  messages: Message[];
  currentUserId: string;
  typingText: string | null;
  suggestions?: string[];
  onSendMessage: (content: string) => void;
  onTyping: () => void;
  onUploadImage: (file: File) => Promise<string | null>;
  onBackClick?: () => void;
  showBack?: boolean;
  onClearChat: () => void;
  onRemoveFriend: () => void;
  onBlock: () => void;
  onReport: (reason: string, details: string) => Promise<boolean>;
  onLeaveGroup: () => void;
  friendLocation: LiveLocation | null;
  isSharingLocation: boolean;
  onToggleLocation: () => void;
};

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}

export default function ChatWindow(props: ChatWindowProps) {
  const { user, group, messages, currentUserId, typingText, friendLocation, isSharingLocation } = props;
  const [reporting, setReporting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const members = group
    ? Object.fromEntries(group.members.map((m) => [m.userId, { name: m.user.name, avatar: avatarFor(m.user) }]))
    : undefined;

  const subtitle = typingText ?? (group ? `${group.members.length} members` : null);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      <div className="absolute left-0 right-0 top-0 z-20">
        <ChatHeader
          user={user}
          subtitle={subtitle}
          isGroup={!!group}
          onBackClick={props.onBackClick}
          showBack={props.showBack}
          onClearChat={props.onClearChat}
          onRemoveFriend={props.onRemoveFriend}
          onBlock={props.onBlock}
          onReport={() => setReporting(true)}
          onLeaveGroup={props.onLeaveGroup}
          onShowMembers={() => setShowMembers(true)}
          isSharingLocation={isSharingLocation}
          onToggleLocation={props.onToggleLocation}
        />
        {(friendLocation || isSharingLocation) && (
          <div className="flex flex-col gap-1 border-b border-border bg-emerald-500/10 px-4 py-2 text-xs backdrop-blur-md">
            {friendLocation && (
              <a
                href={mapsUrlFor(friendLocation.lat, friendLocation.lng)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400"
              >
                <Navigation className="size-3.5" />
                <span className="flex-1">
                  {user?.name.split(" ")[0]} is sharing live location · {ago(friendLocation.at)}
                </span>
                <span className="font-semibold underline">Open map</span>
              </a>
            )}
            {isSharingLocation && (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <MapPin className="size-3.5 animate-pulse" />
                <span className="flex-1">You're sharing your live location (stops after 1 hour)</span>
                <button onClick={props.onToggleLocation} className="font-semibold underline">
                  Stop
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        otherUserAvatar={user?.avatar}
        members={members}
        typingLabel={typingText}
        emptyHint={
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-foreground/50">
            {group
              ? "Say hi to the group and agree on a train and a meeting point."
              : "Say hi! Use 📍 to share where to meet."}
          </p>
        }
      />
      <div className="relative z-20 border-t border-border bg-background">
        <MessageInput
          onSendMessage={props.onSendMessage}
          onTyping={props.onTyping}
          onUploadImage={props.onUploadImage}
          suggestions={messages.length === 0 ? props.suggestions : []}
          disabled={!user}
        />
      </div>

      {reporting && user && <ReportDialog name={user.name} onSubmit={props.onReport} onClose={() => setReporting(false)} />}

      {showMembers && group && (
        <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={() => setShowMembers(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <button onClick={() => setShowMembers(false)} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-foreground/40 hover:bg-foreground/5" aria-label="Close">
              <X className="size-4" />
            </button>
            <h3 className="mb-3 text-lg font-semibold">{group.name}</h3>
            {group.members.map((m) => (
              <a key={m.userId} href={`/user/${m.userId}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-foreground/5">
                <img src={avatarFor(m.user)} alt="" className="size-9 rounded-full object-cover" />
                <span className="flex-1 text-sm">
                  {m.user.name}
                  {m.userId === currentUserId && <span className="text-foreground/45"> (you)</span>}
                </span>
                {m.userId === group.createdById && <span className="text-[11px] text-foreground/45">Admin</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
