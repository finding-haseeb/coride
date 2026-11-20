import { useState } from "react";
import { Check, Loader2, Users, X } from "lucide-react";
import { avatarFor, errorMessage } from "../../../lib/api";

interface Friend {
  id: string;
  name: string;
  username: string;
  profile_image?: string | null;
}

export default function CreateGroupDialog({
  friends,
  onCreate,
  onClose,
}: {
  friends: Friend[];
  onCreate: (name: string, memberIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), picked);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not create the group"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-title"
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85dvh] w-full max-w-sm flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in-up"
      >
        <button onClick={onClose} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-foreground/40 hover:bg-foreground/5" aria-label="Close">
          <X className="size-4" />
        </button>
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Users className="size-5" />
        </div>
        <h3 id="group-title" className="text-lg font-semibold text-foreground">New ride group</h3>
        <p className="mt-1 text-sm text-foreground/60">Plan a shared ride with up to 7 friends.</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="Group name, e.g. Blue Line 9 AM"
          className="mt-4 h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {friends.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-foreground/55">
              Add friends from the map first.
            </p>
          ) : (
            friends.map((f) => (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-foreground/5"
                aria-pressed={picked.includes(f.id)}
              >
                <img src={avatarFor(f)} alt="" className="size-9 rounded-full object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
                <span className={`grid size-5 place-items-center rounded-full border ${picked.includes(f.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {picked.includes(f.id) && <Check className="size-3" />}
                </span>
              </button>
            ))
          )}
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button
          onClick={create}
          disabled={!name.trim() || picked.length === 0 || picked.length > 7 || busy}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Create group{picked.length ? ` (${picked.length + 1})` : ""}
        </button>
      </div>
    </div>
  );
}
