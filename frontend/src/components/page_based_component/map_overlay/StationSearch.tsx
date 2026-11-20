import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { lineColor, lineName } from "../../../pages/map_page/metroLines";

export interface StationOption {
  name: string;
  lines: string[];
}

interface StationSearchProps {
  label: string;
  marker: "A" | "B";
  value: string;
  options: StationOption[];
  placeholder: string;
  onSelect: (name: string) => void;
  onClear: () => void;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function score(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) return 60;
  if (n.includes(q)) return 40;
  if (normalize(n).includes(normalize(q))) return 30;
  // Loose subsequence match for typos like "rjv chk".
  let i = 0;
  const nn = normalize(n);
  for (const ch of normalize(q)) {
    i = nn.indexOf(ch, i);
    if (i === -1) return -1;
    i++;
  }
  return 10;
}

export function StationSearch({
  label,
  marker,
  value,
  options,
  placeholder,
  onSelect,
  onClear,
}: StationSearchProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the text in sync when the route changes from a map click.
  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [value]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q || q === value) return options.slice(0, 8);
    return options
      .map((o) => ({ o, s: score(o.name, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.o.name.localeCompare(b.o.name))
      .slice(0, 8)
      .map((x) => x.o);
  }, [query, options, value]);

  const choose = (name: string) => {
    onSelect(name);
    setQuery(name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active].name);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <div
        className={`flex items-center gap-3 h-12 rounded-xl border bg-background px-3 transition-colors ${
          open ? "border-primary ring-4 ring-primary/10" : "border-border hover:border-foreground/20"
        }`}
      >
        <span
          className={`grid place-items-center size-6 shrink-0 rounded-full text-[11px] font-semibold text-white ${
            marker === "A" ? "bg-emerald-500" : "bg-rose-500"
          }`}
          aria-hidden
        >
          {marker}
        </span>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={(e) => {
            setOpen(true);
            setActive(0);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-foreground/40 outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              setQuery("");
              inputRef.current?.focus();
            }}
            className="grid place-items-center size-7 rounded-full text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
            aria-label={`Clear ${label}`}
          >
            <X className="size-4" />
          </button>
        ) : (
          <Search className="size-4 text-foreground/30" aria-hidden />
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-foreground/50">No station found</li>
          ) : (
            results.map((o, i) => (
              <li
                key={o.name}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.name);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${
                  i === active ? "bg-primary/10" : ""
                }`}
              >
                <span className="truncate text-sm text-foreground">{o.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {o.lines.map((l) => (
                    <span
                      key={l}
                      title={lineName(l)}
                      className="size-2.5 rounded-full ring-2 ring-card"
                      style={{ background: lineColor(l) }}
                    />
                  ))}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
