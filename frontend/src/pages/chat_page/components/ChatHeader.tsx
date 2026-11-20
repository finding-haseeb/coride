import { useState, useRef, useEffect } from "react";
import { BadgeCheck, ChevronLeft, Flag, LogOut, MapPin, MoreVertical, Ban, Trash2, UserMinus, Users } from "lucide-react";
import { SosButton } from "../../../components/safety/SosButton";
import type { User } from "../types";

type ChatHeaderProps = {
  user: User | null;
  subtitle?: string | null;
  isGroup?: boolean;
  onBackClick?: () => void;
  showBack?: boolean;
  onClearChat?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onReport?: () => void;
  onLeaveGroup?: () => void;
  onShowMembers?: () => void;
  isSharingLocation?: boolean;
  onToggleLocation?: () => void;
};

export default function ChatHeader({
  user,
  subtitle,
  isGroup = false,
  onBackClick,
  showBack = false,
  onClearChat,
  onRemoveFriend,
  onBlock,
  onReport,
  onLeaveGroup,
  onShowMembers,
  isSharingLocation = false,
  onToggleLocation,
}: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) {
    return (
      <div className="relative z-10 flex h-16 items-center border-b border-border bg-background/80 px-4 backdrop-blur-md">
        <h1 className="font-headline text-foreground">Select a chat</h1>
      </div>
    );
  }

  const item = (label: string, icon: React.ReactNode, onClick?: () => void, danger = false) =>
    onClick && (
      <button
        onClick={() => {
          setShowMenu(false);
          onClick();
        }}
        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-foreground/5 ${
          danger ? "text-rose-600 dark:text-rose-400" : "text-foreground"
        }`}
      >
        {icon}
        {label}
      </button>
    );

  return (
    <div className="relative z-10 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/80 px-3 font-sans backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center">
        {showBack && (
          <button
            onClick={onBackClick}
            className="mr-1 rounded-full p-2 text-foreground/50 transition-colors hover:bg-card hover:text-foreground md:hidden"
            aria-label="Back to chats"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        <div className="relative shrink-0">
          <img src={user.avatar} alt="" className="size-9 rounded-full border border-border bg-card object-cover" />
          {!isGroup && user.status === "online" && (
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
          )}
        </div>
        <button
          onClick={isGroup ? onShowMembers : undefined}
          className="ml-3 min-w-0 text-left"
          disabled={!isGroup}
        >
          <h2 className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
            {user.name}
            {user.verified && <BadgeCheck className="size-3.5 shrink-0 text-sky-500" aria-label="Verified" />}
          </h2>
          <p className={`truncate text-[11px] ${subtitle?.includes("typing") ? "text-primary" : "text-foreground/50"}`}>
            {subtitle ?? (isGroup ? "Group" : user.status === "online" ? "Online" : "Offline")}
          </p>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {!isGroup && onToggleLocation && (
          <button
            onClick={onToggleLocation}
            className={`grid size-9 place-items-center rounded-full transition-colors ${
              isSharingLocation ? "bg-emerald-500/15 text-emerald-600" : "text-foreground/50 hover:bg-card hover:text-foreground"
            }`}
            title={isSharingLocation ? "Stop sharing live location" : "Share live location"}
            aria-pressed={isSharingLocation}
          >
            <MapPin className="size-[18px]" />
          </button>
        )}
        <SosButton className="h-8 px-2.5" />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="grid size-9 place-items-center rounded-full text-foreground/50 transition-colors hover:bg-card hover:text-foreground"
            aria-label="Chat options"
            aria-expanded={showMenu}
          >
            <MoreVertical className="size-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-11 z-50 w-56 origin-top-right overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl animate-fade-in-up">
              {isGroup ? (
                <>
                  {item("Members", <Users className="size-4" />, onShowMembers)}
                  {item("Leave group", <LogOut className="size-4" />, onLeaveGroup, true)}
                </>
              ) : (
                <>
                  {item(isSharingLocation ? "Stop live location" : "Share live location", <MapPin className="size-4" />, onToggleLocation)}
                  {item("Clear chat", <Trash2 className="size-4" />, onClearChat)}
                  {item("Remove friend", <UserMinus className="size-4" />, onRemoveFriend, true)}
                  <div className="my-1 border-t border-border" />
                  {item("Report", <Flag className="size-4" />, onReport, true)}
                  {item("Block", <Ban className="size-4" />, onBlock, true)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
