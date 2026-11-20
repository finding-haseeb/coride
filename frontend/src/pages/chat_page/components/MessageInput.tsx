import { useState, useRef, useEffect } from "react";
import { Smile, Image as ImageIcon, Send, MapPin, Loader2, Sparkles } from "lucide-react";
import { REVERSE_STATIONS_MAP } from "../../../utils/stationsMap";
import { meetupMessage } from "../../../utils/metroInfo";

type MessageInputProps = {
  onSendMessage: (content: string) => void;
  onTyping?: () => void;
  onUploadImage?: (file: File) => Promise<string | null>;
  suggestions?: string[];
  disabled?: boolean;
};

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "✨", "💯", "🎉", "😊", "😎", "🤔", "🙌", "👀", "👌", "🤌", "🚇", "🚉", "🚂"];
const STATION_NAMES = Object.keys(REVERSE_STATIONS_MAP).sort();

export default function MessageInput({
  onSendMessage,
  onTyping,
  onUploadImage,
  suggestions = [],
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"none" | "emoji" | "meetup">("none");
  const [station, setStation] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setPanel("none");
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const send = (text: string) => {
    if (text.trim() && !disabled) {
      onSendMessage(text.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file || !onUploadImage) return;
    setUploading(true);
    const url = await onUploadImage(file);
    setUploading(false);
    if (url) onSendMessage(`[Image: ${url}]`);
  };

  const validStation = STATION_NAMES.includes(station);

  return (
    <div className="relative border-t border-border bg-background px-3 py-3 font-sans">
      {suggestions.length > 0 && !message && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          <Sparkles className="mt-1.5 size-3.5 shrink-0 text-primary" aria-hidden />
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={disabled}
              className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-foreground/80 hover:bg-primary/10"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {panel !== "none" && (
        <div ref={panelRef} className="absolute bottom-full left-3 z-50 mb-2 rounded-2xl border border-border bg-card p-3 shadow-xl animate-fade-in-up">
          {panel === "emoji" ? (
            <div className="grid w-60 grid-cols-5 gap-1.5">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setMessage((prev) => prev + emoji);
                    setPanel("none");
                    textareaRef.current?.focus();
                  }}
                  className="grid place-items-center rounded-lg p-1.5 text-2xl hover:bg-background"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="flex w-72 flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!validStation) return;
                onSendMessage(meetupMessage(station, note));
                setStation("");
                setNote("");
                setPanel("none");
              }}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <MapPin className="size-4 text-primary" /> Share a meeting point
              </p>
              <input
                list="meetup-stations"
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="Station, e.g. Rajiv Chowk"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <datalist id="meetup-stations">
                {STATION_NAMES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={60}
                placeholder="Gate, coach or time (optional)"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!validStation}
                className="h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                Send meeting point
              </button>
            </form>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(message);
        }}
        className="flex items-end gap-1"
      >
        <IconButton label="Emoji" active={panel === "emoji"} disabled={disabled} onClick={() => setPanel(panel === "emoji" ? "none" : "emoji")}>
          <Smile className="size-5" />
        </IconButton>
        <IconButton label="Meeting point" active={panel === "meetup"} disabled={disabled} onClick={() => setPanel(panel === "meetup" ? "none" : "meetup")}>
          <MapPin className="size-5" />
        </IconButton>
        {onUploadImage && (
          <IconButton label="Send a photo" disabled={disabled || uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-5" />}
          </IconButton>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

        <div className="flex flex-1 items-center rounded-[var(--radius-pill)] border border-border bg-card px-4 py-2 shadow-inner">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            maxLength={2000}
            aria-label="Message"
            className="custom-scrollbar mt-1 max-h-32 flex-1 resize-none bg-transparent font-body-sm text-foreground placeholder-foreground/50 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!message.trim() || disabled}
          aria-label="Send"
          className={`flex items-center justify-center rounded-[var(--radius-pill)] border p-3.5 transition-all duration-200 ${
            message.trim() && !disabled
              ? "border-primary bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              : "cursor-not-allowed border-border bg-background text-foreground/30"
          }`}
        >
          <Send className="ml-0.5 size-4" />
        </button>
      </form>
    </div>
  );
}

function IconButton({
  label,
  active = false,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-full p-2 transition-colors disabled:opacity-40 ${active ? "bg-card text-foreground" : "text-foreground/50 hover:bg-card hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
