import { BellRing, CheckCircle2, LocateFixed, Navigation, PlayCircle, Repeat2, Square, TrainFront } from "lucide-react";
import type { JourneyState } from "../../../hooks/useJourney";

interface JourneyPanelProps {
  path: string[];
  state: JourneyState;
  alarms: number[];
  onStart: (demo?: boolean) => void;
  onStop: () => void;
}

const MODE_LABEL: Record<JourneyState["mode"], string> = {
  gps: "Live GPS",
  estimate: "Estimated from time",
  demo: "Demo ride",
};

export function JourneyPanel({ path, state, alarms, onStart, onStop }: JourneyPanelProps) {
  if (path.length < 2) return null;

  if (!state.active) {
    return (
      <div className="mx-5 mt-4 rounded-2xl border border-border bg-background/60 p-3.5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <BellRing className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Station alarm</p>
            <p className="text-xs text-foreground/55">
              Shows which station you're at and wakes you one stop before {path[path.length - 1]}
              {alarms.length > 1 ? ` and before each of ${alarms.length - 1} line change${alarms.length > 2 ? "s" : ""}` : ""}.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onStart(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
          >
            <Navigation className="size-4" /> Start journey
          </button>
          <button
            onClick={() => onStart(true)}
            title="Simulates the ride (4 s per station) so you can try the alarm"
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/5"
          >
            <PlayCircle className="size-4" /> Demo
          </button>
        </div>
      </div>
    );
  }

  const last = path.length - 1;
  const pct = Math.round((state.progress / last) * 100);
  const current = path[state.atIndex];
  const next = state.nextIndex !== null ? path[state.nextIndex] : null;
  const nextAlarm = alarms.find((i) => i > state.atIndex);

  return (
    <div className="mx-5 mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="flex items-center gap-1 text-primary">
          <LocateFixed className={`size-3.5 ${state.arrived ? "" : "animate-pulse"}`} />
          {MODE_LABEL[state.mode]}
          {state.mode === "gps" && state.position?.accuracy ? ` · ±${Math.round(state.position.accuracy)} m` : ""}
        </span>
        <span className="text-foreground/50">{pct}%</span>
      </div>

      {state.arrived ? (
        <p className="mt-2 flex items-center gap-2 text-base font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-5" /> You've reached {path[last]}
        </p>
      ) : (
        <div className="mt-2 space-y-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <TrainFront className="size-4.5 text-primary" />
            {state.atStation ? `At ${current}` : `Between ${current} and ${next}`}
          </p>
          {next && (
            <p className="text-xs text-foreground/60">
              Next: <b className="text-foreground/80">{next}</b> · {state.stopsLeft} stop{state.stopsLeft === 1 ? "" : "s"} to{" "}
              {path[last]}
            </p>
          )}
          {nextAlarm !== undefined && nextAlarm !== last && (
            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <Repeat2 className="size-3.5" /> Change trains at {path[nextAlarm]}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Stop list with the current position */}
      <ol className="mt-3 max-h-40 space-y-0.5 overflow-y-auto pr-1 text-xs">
        {path.map((s, i) => {
          const passed = i < state.atIndex || (i === state.atIndex && !state.atStation);
          const here = i === state.atIndex && state.atStation;
          const alarmStop = alarms.includes(i);
          return (
            <li key={`${s}-${i}`} className={`flex items-center gap-2 ${passed ? "text-foreground/35" : "text-foreground/75"}`}>
              <span
                className={`size-2 shrink-0 rounded-full ${here ? "bg-primary ring-4 ring-primary/25" : passed ? "bg-foreground/25" : "bg-foreground/40"}`}
              />
              <span className={here ? "font-semibold text-foreground" : ""}>{s}</span>
              {alarmStop && <BellRing className="size-3 text-amber-500" aria-label="Alarm before this stop" />}
            </li>
          );
        })}
      </ol>

      {state.error && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">{state.error}</p>}
      {state.mode !== "demo" && (
        <p className="mt-2 text-[10px] leading-snug text-foreground/40">
          GPS is weak underground, so between fixes the position is estimated from typical travel time. Keep this
          page open; the screen is kept awake where the browser allows.
        </p>
      )}

      <button
        onClick={onStop}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm text-foreground/75 hover:bg-foreground/5"
      >
        <Square className="size-3.5" /> {state.arrived ? "Done" : "Stop journey"}
      </button>
    </div>
  );
}

export function JourneyAlarm({ state, onDismiss }: { state: JourneyState; onDismiss: () => void }) {
  if (!state.alarm) return null;
  const { station, isDestination } = state.alarm;
  return (
    <div className="pointer-events-auto fixed inset-0 z-[3000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm" role="alertdialog" aria-live="assertive">
      <div className="w-full max-w-sm animate-[pulse_1.2s_ease-in-out_infinite] rounded-3xl bg-card p-6 text-center shadow-2xl ring-4 ring-amber-400">
        <BellRing className="mx-auto size-12 text-amber-500" />
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-foreground/55">
          {isDestination ? "Your stop is next" : "Change trains next"}
        </p>
        <p className="mt-1 text-2xl font-bold text-foreground">{station}</p>
        <p className="mt-2 text-sm text-foreground/60">
          {isDestination ? "Get ready to get off at the next station." : "Get off at the next station to change line."}
        </p>
        <button onClick={onDismiss} className="mt-5 w-full rounded-2xl bg-primary py-3 text-base font-semibold text-primary-foreground">
          I'm awake
        </button>
      </div>
    </div>
  );
}
