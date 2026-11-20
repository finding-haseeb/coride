import { useState } from "react";
import { Layers, Map as MapIcon, Route } from "lucide-react";
import { METRO_LINES } from "../metroLines";
import type { BasemapStyle } from "../constants";

interface MapControlsProps {
  basemap: BasemapStyle;
  onBasemapChange: (b: BasemapStyle) => void;
  hiddenLines: Set<string>;
  onToggleLine: (key: string) => void;
  onShowAll: () => void;
}

export function MapControls({
  basemap,
  onBasemapChange,
  hiddenLines,
  onToggleLine,
  onShowAll,
}: MapControlsProps) {
  const [open, setOpen] = useState(() => window.innerWidth >= 1440);

  return (
    <div className="pointer-events-auto absolute right-4 top-[4.25rem] z-[1000] flex flex-col items-end gap-2">
      <div className="flex rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur-xl">
        {(
          [
            ["minimal", "Minimal", Route],
            ["street", "Street", MapIcon],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => onBasemapChange(key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              basemap === key
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
            aria-pressed={basemap === key}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`ml-1 grid size-8 place-items-center rounded-full transition ${
            open ? "bg-foreground/10 text-foreground" : "text-foreground/60 hover:text-foreground"
          }`}
          aria-label="Metro lines"
          aria-expanded={open}
          title="Metro lines"
        >
          <Layers className="size-4" />
        </button>
      </div>

      {open && (
        <div className="w-56 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-xl animate-fade-in-up [animation-duration:0.3s]">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
              Metro lines
            </span>
            {hiddenLines.size > 0 && (
              <button onClick={onShowAll} className="text-xs font-medium text-primary">
                Show all
              </button>
            )}
          </div>
          <ul className="flex flex-col">
            {METRO_LINES.map((l) => {
              const hidden = hiddenLines.has(l.key);
              return (
                <li key={l.key}>
                  <button
                    onClick={() => onToggleLine(l.key)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:bg-foreground/5 ${
                      hidden ? "text-foreground/35" : "text-foreground"
                    }`}
                    aria-pressed={!hidden}
                  >
                    <span
                      className="h-1.5 w-5 rounded-full transition-opacity"
                      style={{ background: l.color, opacity: hidden ? 0.3 : 1 }}
                    />
                    {l.name}
                  </button>
                </li>
              );
            })}
            <li className="mt-1 flex items-center gap-2.5 border-t border-border px-2 pt-2 text-[13px] text-foreground/60">
              <span className="grid size-3.5 place-items-center rounded-full border-[2.5px] border-gray-800 bg-white dark:border-gray-200 dark:bg-gray-900" />
              Interchange
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
