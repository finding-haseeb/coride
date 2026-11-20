import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Graph } from "../pages/map_page/types";
import {
  advanceByTime,
  alarmStops,
  dueAlarm,
  hopDurationsMs,
  journeyView,
  locateOnRoute,
  type JourneyView,
} from "../utils/journey";

export type JourneyMode = "gps" | "estimate" | "demo";

export interface JourneyAlarm {
  stop: number;
  station: string;
  isDestination: boolean;
}

export interface JourneyState extends JourneyView {
  active: boolean;
  mode: JourneyMode;
  progress: number;
  position: { lat: number; lng: number; accuracy: number | null } | null;
  alarm: JourneyAlarm | null;
  arrived: boolean;
  error: string | null;
}

/** GPS fixes worse than this (metres) are ignored; common underground. */
const MAX_ACCURACY_M = 400;
/** A fix this far from the line is not on this train. */
const MAX_OFF_ROUTE_M = 800;
/** Without a usable fix for this long, switch to the time estimate. */
const GPS_STALE_MS = 45_000;
const DEMO_HOP_MS = 4000;

// --- alarm output -------------------------------------------------------

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    void ctx.resume();
    [0, 0.35, 0.7].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.26);
    });
  } catch {
    /* no audio available */
  }
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function systemNotify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "coride-journey", requireInteraction: true } as NotificationOptions);
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
    navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, tag: "coride-journey" })).catch(() => undefined);
  }
}

// --- hook ---------------------------------------------------------------

export function useJourney(path: string[], graph: Graph) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<JourneyMode>("gps");
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState<JourneyState["position"]>(null);
  const [alarm, setAlarm] = useState<JourneyAlarm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alarms = useMemo(() => alarmStops(path, graph), [path, graph]);
  const hops = useMemo(() => hopDurationsMs(path, graph), [path, graph]);

  const announced = useRef(new Set<number>());
  const lastFix = useRef<{ progress: number; at: number } | null>(null);
  const progressRef = useRef(0);
  const watchId = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const ringTimer = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const isDemo = useRef(false);

  const setProg = (p: number) => {
    // Trains only go forward; ignore small GPS jitter backwards.
    const next = Math.max(progressRef.current, Math.min(p, path.length - 1));
    progressRef.current = next;
    setProgress(next);
  };

  const stopRinging = useCallback(() => {
    if (ringTimer.current) window.clearInterval(ringTimer.current);
    ringTimer.current = null;
    navigator.vibrate?.(0);
  }, []);

  const dismissAlarm = useCallback(() => {
    stopRinging();
    setAlarm(null);
  }, [stopRinging]);

  const cleanup = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timer.current) window.clearInterval(timer.current);
    watchId.current = null;
    timer.current = null;
    stopRinging();
    wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, [stopRinging]);

  const stop = useCallback(() => {
    cleanup();
    setActive(false);
    setAlarm(null);
    setPosition(null);
  }, [cleanup]);

  const start = useCallback(
    async (demo = false) => {
      if (path.length < 2) return;
      cleanup();
      announced.current = new Set();
      progressRef.current = 0;
      lastFix.current = null;
      isDemo.current = demo;
      setProgress(0);
      setAlarm(null);
      setError(null);
      setPosition(null);
      setMode(demo ? "demo" : "gps");
      setActive(true);
      beep(); // unlocks audio on iOS while we still have the tap gesture
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => undefined);
      }
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        wakeLock.current = (await wl?.request("screen")) ?? null;
      } catch {
        /* screen may turn off; notifications still fire while the page runs */
      }

      const startedAt = Date.now();
      if (demo) {
        timer.current = window.setInterval(() => {
          setProg(((Date.now() - startedAt) / DEMO_HOP_MS));
        }, 500);
        return;
      }

      if (!("geolocation" in navigator)) {
        setError("This browser can't share location. Using a time estimate.");
        setMode("estimate");
      } else {
        watchId.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude: lat, longitude: lng, accuracy } = pos.coords;
            setPosition({ lat, lng, accuracy });
            if (accuracy > MAX_ACCURACY_M) return;
            const loc = locateOnRoute(path, graph, lat, lng);
            if (!loc || loc.offRouteM > MAX_OFF_ROUTE_M) {
              setError("You seem to be away from this route.");
              return;
            }
            setError(null);
            setMode("gps");
            setProg(loc.progress);
            lastFix.current = { progress: progressRef.current, at: Date.now() };
          },
          (err) => {
            setError(
              err.code === err.PERMISSION_DENIED
                ? "Location is blocked. Using a time estimate instead."
                : "No GPS signal (common underground). Using a time estimate.",
            );
            setMode("estimate");
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
        );
      }

      // Time estimate fills the gaps between GPS fixes.
      timer.current = window.setInterval(() => {
        const fix = lastFix.current;
        const base = fix ?? { progress: 0, at: startedAt };
        if (fix && Date.now() - fix.at < GPS_STALE_MS) return;
        setMode("estimate");
        setProg(advanceByTime(base.progress, Date.now() - base.at, hops));
      }, 3000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, graph, hops, cleanup],
  );

  // Fire alarms when the rider reaches the stop before an alarm stop.
  useEffect(() => {
    if (!active) return;
    const stopIdx = dueAlarm(progress, alarms, announced.current);
    if (stopIdx === null) return;
    announced.current.add(stopIdx);
    const station = path[stopIdx];
    const isDestination = stopIdx === path.length - 1;
    const text = isDestination
      ? `Next station is ${station}. Get ready to get off.`
      : `Next station is ${station}. Change trains there.`;
    setAlarm({ stop: stopIdx, station, isDestination });
    systemNotify(isDestination ? "Your stop is next" : "Interchange is next", text);
    speak(text);
    beep();
    navigator.vibrate?.([500, 200, 500, 200, 800]);
    stopRinging();
    ringTimer.current = window.setInterval(() => {
      beep();
      navigator.vibrate?.([500, 200, 500]);
    }, 4000);
  }, [active, progress, alarms, path, stopRinging]);

  // Reached the destination: stop tracking shortly after.
  const arrived = active && progress >= path.length - 1 - 0.05;
  useEffect(() => {
    if (!arrived) return;
    systemNotify("You've arrived", `You're at ${path[path.length - 1]}.`);
    const t = window.setTimeout(() => {
      cleanup();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [arrived, cleanup, path]);

  // Route changed or page closed: stop.
  useEffect(() => stop, [path, stop]);

  const view = journeyView(progress, path.length);
  const state: JourneyState = { ...view, active, mode, progress, position, alarm, arrived, error };
  return { state, start, stop, dismissAlarm, alarms };
}
