import { useState } from "react";
import {
  ArrowDownUp, BadgeCheck, Clock, ExternalLink, IndianRupee, Lightbulb, Loader2, RotateCcw, SlidersHorizontal, Sparkles, Timer, Users, UsersRound,
} from "lucide-react";
import { estimateCrowd, estimateFare, lessCrowdedTime, stationMapsUrl, typicalWait } from "../../../utils/metroInfo";
import { StationSearch, type StationOption } from "./StationSearch";
import type { RouteSummary } from "./routeSummary";
import { lineColor, lineName } from "../../../pages/map_page/metroLines";

export interface RouteSettingsProps {
  startStation: string;
  endStation: string;
  options: StationOption[];
  onSelectStart: (name: string) => void;
  onSelectEnd: (name: string) => void;
  onSwap: () => void;
  onReset: () => void;
  summary: RouteSummary | null;
  tripTime: string;
  setTripTime: (time: string) => void;
  isLoading: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  path: string[];
  filters: MatchFilters;
  setFilters: (f: MatchFilters) => void;
  onSmartSearch: (text: string) => Promise<string | null>;
}

export interface MatchFilters {
  womenOnly: boolean;
  verifiedOnly: boolean;
  ageMin: string;
  ageMax: string;
}

export const NO_FILTERS: MatchFilters = { womenOnly: false, verifiedOnly: false, ageMin: "", ageMax: "" };

export function RouteSettings({
  startStation,
  endStation,
  options,
  onSelectStart,
  onSelectEnd,
  onSwap,
  onReset,
  summary,
  tripTime,
  setTripTime,
  isLoading,
  canSubmit,
  onSubmit,
  path,
  filters,
  setFilters,
  onSmartSearch,
}: RouteSettingsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [askNote, setAskNote] = useState<string | null>(null);
  const when = tripTime ? new Date(tripTime) : new Date();
  const fare = summary ? estimateFare(summary.distanceKm, when) : null;
  const wait = summary ? typicalWait(summary.lines, when) : null;
  const crowd = summary ? estimateCrowd(path, when) : null;
  const betterTime = summary ? lessCrowdedTime(path, when) : null;

  const submitAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ask.trim() || asking) return;
    setAsking(true);
    setAskNote(await onSmartSearch(ask.trim()));
    setAsking(false);
  };
  const activeFilters =
    Number(filters.womenOnly) + Number(filters.verifiedOnly) + Number(!!(filters.ageMin || filters.ageMax));
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Plan your ride</h2>
          <p className="text-[13px] text-foreground/55">
            Type a station or tap one on the map
          </p>
        </div>
        {(startStation || endStation) && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
        )}
      </div>

      <form onSubmit={submitAsk} className="flex flex-col gap-1.5">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="sr-only">Describe your trip</span>
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Kal subah 9 baje Rajiv Chowk se Noida Sector 62"
            maxLength={300}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-foreground/40"
          />
          <button
            type="submit"
            disabled={!ask.trim() || asking}
            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {asking ? <Loader2 className="size-3.5 animate-spin" /> : "Go"}
          </button>
        </label>
        {askNote && <p className="px-1 text-[11px] text-foreground/55">{askNote}</p>}
      </form>

      <div className="relative flex flex-col gap-2">
        <StationSearch
          label="Start station"
          marker="A"
          value={startStation}
          options={options}
          placeholder="From: e.g. Rajiv Chowk"
          onSelect={onSelectStart}
          onClear={() => onSelectStart("")}
        />
        <StationSearch
          label="End station"
          marker="B"
          value={endStation}
          options={options}
          placeholder="To: e.g. Huda City Centre"
          onSelect={onSelectEnd}
          onClear={() => onSelectEnd("")}
        />
        <button
          onClick={onSwap}
          disabled={!startStation && !endStation}
          className="absolute right-12 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-foreground/60 shadow-sm transition hover:text-primary disabled:opacity-0"
          aria-label="Swap start and end"
          title="Swap"
        >
          <ArrowDownUp className="size-4" />
        </button>
      </div>

      {summary && (
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            <Stat value={`${summary.minutes}`} unit="min" label="Est. time" />
            <Stat value={`${summary.stops}`} unit="stops" label="Stations" />
            <Stat value={`${summary.distanceKm}`} unit="km" label="Distance" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {summary.lines.map((l, i) => (
              <span key={`${l}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-foreground/30">›</span>}
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ background: lineColor(l) }}
                >
                  {lineName(l)}
                </span>
              </span>
            ))}
            <span className="ml-auto text-[11px] text-foreground/50">
              {summary.interchanges === 0
                ? "Direct"
                : `${summary.interchanges} change${summary.interchanges > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[11px]">
            <Info icon={<IndianRupee className="size-3.5" />} label="Fare (approx.)">
              ₹{fare!.fare}
              <span className="ml-1 text-foreground/45">card ₹{fare!.smartCard}</span>
            </Info>
            <Info icon={<Timer className="size-3.5" />} label="Train every">
              {wait === null ? "Closed" : `~${wait} min`}
            </Info>
            <Info icon={<UsersRound className="size-3.5" />} label="Crowd (est.)">
              <span className={crowdTone(crowd)}>{crowd ?? "—"}</span>
            </Info>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            {[startStation, endStation].filter(Boolean).map((s) => (
              <a
                key={s}
                href={stationMapsUrl(s)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {s} on Maps <ExternalLink className="size-3" />
              </a>
            ))}
          </div>
          {betterTime && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
              <Lightbulb className="mt-px size-3.5 shrink-0" />
              <span>
                Leaving at{" "}
                <b>{betterTime.date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b> (
                {Math.abs(betterTime.diffMin)} min {betterTime.diffMin < 0 ? "earlier" : "later"}) should be less
                crowded: {betterTime.level.toLowerCase()} instead of {crowd?.toLowerCase()}.
              </span>
            </p>
          )}
          <p className="mt-2 text-[10px] leading-snug text-foreground/40">
            {fare!.reducedDay ? "Sunday/holiday fare. " : ""}Fare from the DMRC table by route distance; train
            gaps and crowd are typical patterns, not live data.
          </p>
        </div>
      )}

      <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-background px-3 transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <Clock className="size-4 text-foreground/40" aria-hidden />
        <span className="sr-only">Departure time</span>
        <input
          type="datetime-local"
          value={tripTime}
          onChange={(e) => setTripTime(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>

      <div className="rounded-xl border border-border">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-foreground/75"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="size-4 text-foreground/45" />
          Co-rider filters
          {activeFilters > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {activeFilters}
            </span>
          )}
          <span className="ml-auto text-[11px] text-foreground/40">{showFilters ? "Hide" : "Show"}</span>
        </button>
        {showFilters && (
          <div className="flex flex-col gap-2.5 border-t border-border px-3 py-3 text-[13px]">
            <Toggle
              checked={filters.womenOnly}
              onChange={(v) => setFilters({ ...filters, womenOnly: v })}
              label="Women only"
              hint="Only show co-riders whose profile says female"
            />
            <Toggle
              checked={filters.verifiedOnly}
              onChange={(v) => setFilters({ ...filters, verifiedOnly: v })}
              label={
                <span className="inline-flex items-center gap-1">
                  Verified only <BadgeCheck className="size-3.5 text-sky-500" />
                </span>
              }
              hint="People who confirmed their email"
            />
            <div className="flex items-center gap-2">
              <span className="flex-1 text-foreground/75">Age</span>
              <input
                inputMode="numeric"
                placeholder="min"
                value={filters.ageMin}
                onChange={(e) => setFilters({ ...filters, ageMin: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-center outline-none focus:border-primary"
                aria-label="Minimum age"
              />
              <span className="text-foreground/40">–</span>
              <input
                inputMode="numeric"
                placeholder="max"
                value={filters.ageMax}
                onChange={(e) => setFilters({ ...filters, ageMax: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-center outline-none focus:border-primary"
                aria-label="Maximum age"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={!canSubmit || isLoading}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-foreground/10 disabled:text-foreground/40 disabled:shadow-none"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Users className="size-4" />
        )}
        {isLoading ? "Finding co-riders…" : canSubmit ? "Find co-riders" : "Pick start and end"}
      </button>
    </div>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="px-1">
      <div className="text-lg font-semibold tabular-nums text-foreground">
        {value}
        <span className="ml-0.5 text-xs font-normal text-foreground/50">{unit}</span>
      </div>
      <div className="text-[11px] text-foreground/50">{label}</div>
    </div>
  );
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-foreground/45">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{children}</div>
    </div>
  );
}

function crowdTone(level: string | null) {
  if (level === "Very high") return "text-rose-500";
  if (level === "High") return "text-amber-500";
  if (level === "Moderate") return "text-foreground";
  return "text-emerald-500";
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span className="flex-1">
        <span className="block text-foreground/80">{label}</span>
        <span className="block text-[11px] text-foreground/45">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-5 w-9 rounded-full bg-foreground/15 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}
