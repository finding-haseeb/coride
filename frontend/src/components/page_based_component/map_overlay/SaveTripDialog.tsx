import { useState } from "react";
import { BookmarkPlus, Repeat, X } from "lucide-react";
import { DAY_NAMES } from "../../../utils/metroInfo";

export interface SaveTripDialogProps {
  /** `repeatDays` is empty for a one-off trip. */
  onFinalSubmit: (saveToDb: boolean, repeatDays: number[]) => void;
  onClose: () => void;
  tripDate: Date;
}

export function SaveTripDialog({ onFinalSubmit, onClose, tripDate }: SaveTripDialogProps) {
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<number[]>(() => {
    const d = tripDate.getDay();
    return d === 0 || d === 6 ? [d] : [1, 2, 3, 4, 5];
  });
  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-trip-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in-up"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <BookmarkPlus className="size-5" />
        </div>
        <h3 id="save-trip-title" className="text-lg font-semibold text-foreground">
          Save this trip?
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
          Saved trips let other commuters on this route find you. You can still
          search without saving.
        </p>

        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3">
          <Repeat className="size-4 text-primary" />
          <span className="flex-1 text-sm">
            <span className="block font-medium text-foreground">Repeat every week</span>
            <span className="block text-xs text-foreground/50">For your daily commute at this time</span>
          </span>
          <input
            type="checkbox"
            checked={repeat}
            onChange={(e) => setRepeat(e.target.checked)}
            className="size-4 accent-[var(--color-primary)]"
          />
        </label>
        {repeat && (
          <div className="mt-2 flex justify-between gap-1" role="group" aria-label="Days">
            {DAY_NAMES.map((name, d) => (
              <button
                key={name}
                onClick={() => toggleDay(d)}
                aria-pressed={days.includes(d)}
                className={`h-9 flex-1 rounded-lg text-xs font-medium transition ${
                  days.includes(d)
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-foreground/60 hover:bg-foreground/5"
                }`}
              >
                {name.slice(0, 2)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => onFinalSubmit(false, [])}
            className="h-11 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
          >
            Just search
          </button>
          <button
            onClick={() => onFinalSubmit(true, repeat ? days : [])}
            disabled={repeat && days.length === 0}
            className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {repeat ? "Save weekly & search" : "Save & search"}
          </button>
        </div>
      </div>
    </div>
  );
}
