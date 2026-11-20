import { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";

const REASONS: [string, string][] = [
  ["harassment", "Harassment or abuse"],
  ["unsafe_behaviour", "Made me feel unsafe"],
  ["fake_profile", "Fake profile"],
  ["spam", "Spam or scam"],
  ["no_show", "Didn't show up"],
  ["other", "Something else"],
];

export default function ReportDialog({
  name,
  onSubmit,
  onClose,
}: {
  name: string;
  onSubmit: (reason: string, details: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    const ok = await onSubmit(reason, details);
    setSending(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in-up"
      >
        <button onClick={onClose} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-foreground/40 hover:bg-foreground/5" aria-label="Close">
          <X className="size-4" />
        </button>
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-rose-500/10 text-rose-600">
          <Flag className="size-5" />
        </div>
        <h3 id="report-title" className="text-lg font-semibold text-foreground">Report {name}</h3>
        <p className="mt-1 text-sm text-foreground/60">Reports are private. {name} won't know who reported them.</p>
        <div className="mt-4 flex flex-col gap-1.5">
          {REASONS.map(([value, label]) => (
            <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${reason === value ? "border-primary bg-primary/5" : "border-border hover:bg-foreground/5"}`}>
              <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[var(--color-primary)]" />
              {label}
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What happened? (optional)"
          maxLength={1000}
          rows={3}
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={!reason || sending}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {sending && <Loader2 className="size-4 animate-spin" />} Send report
        </button>
      </div>
    </div>
  );
}
