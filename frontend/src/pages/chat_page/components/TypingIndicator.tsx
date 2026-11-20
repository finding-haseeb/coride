export default function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="mb-4 flex items-end gap-2" aria-live="polite">
      <div className="w-8" />
      <div className="flex items-center gap-2 rounded-3xl rounded-bl-sm border border-border bg-card px-4 py-3">
        <span className="flex gap-1">
          {[0, 0.15, 0.3].map((d) => (
            <span key={d} className="size-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: `${d}s` }} />
          ))}
        </span>
        {label && <span className="text-[11px] text-foreground/50">{label}</span>}
      </div>
    </div>
  );
}
