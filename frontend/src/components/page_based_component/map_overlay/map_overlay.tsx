import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../../../lib/api";
import { getStationId } from "../../../utils/stationsMap";
import { SuffixAutomaton } from "../../../utils/SuffixAutomaton";
import type { Graph } from "../../../pages/map_page/types";
import { stationLines } from "../../../pages/map_page/hooks/useStations";
import { RouteSettings, NO_FILTERS, type MatchFilters } from "./RouteSettings";
import { MatchersList } from "./MatchersList";
import { SaveTripDialog } from "./SaveTripDialog";
import { summarizeRoute } from "./routeSummary";
import type { StationOption } from "./StationSearch";
import { JourneyAlarm, JourneyPanel } from "./JourneyPanel";
import { useJourney } from "../../../hooks/useJourney";

interface MapOverlayProps {
  customPath: string[];
  stations: Graph;
  onRouteChange: (start: string, end: string) => void;
  onReset: () => void;
  /** Rider's live position for the map marker (null when not tracking). */
  onLivePosition?: (p: { lat: number; lng: number; station: string } | null) => void;
}

// How far apart (in minutes) two riders can reach their shared stretch.
const MATCH_WINDOW_MINUTES = 20;

function localNow(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function MapOverlay({ customPath, stations, onRouteChange, onReset, onLivePosition }: MapOverlayProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [matchers, setMatchers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [tripTime, setTripTime] = useState<string>(localNow);
  const [filters, setFilters] = useState<MatchFilters>(NO_FILTERS);
  const [notice, setNotice] = useState<string | null>(null);

  // An end picked before any start waits here until a start is chosen.
  const [draftEnd, setDraftEnd] = useState("");
  const startStation = customPath[0] ?? "";
  const endStation = customPath.length > 1 ? customPath[customPath.length - 1] : draftEnd;

  const changeRoute = (start: string, end: string) => {
    setDraftEnd(start ? "" : end);
    onRouteChange(start, start ? end : "");
  };

  const options: StationOption[] = useMemo(
    () =>
      Object.keys(stations)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name, lines: stationLines(name, stations) })),
    [stations],
  );

  const summary = useMemo(() => summarizeRoute(customPath, stations), [customPath, stations]);

  const journey = useJourney(customPath, stations);
  const js = journey.state;
  // Marker: real GPS point when we have one, otherwise the estimated spot on the line.
  const livePoint = useMemo(() => {
    if (!js.active) return null;
    if (js.mode === "gps" && js.position) return js.position;
    const i = Math.floor(js.progress);
    const a = stations[customPath[i]];
    const b = stations[customPath[Math.min(i + 1, customPath.length - 1)]];
    if (!a || !b) return null;
    const t = js.progress - i;
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  }, [js.active, js.mode, js.position, js.progress, stations, customPath]);
  const liveStation = customPath[js.atIndex] ?? "";
  useEffect(() => {
    onLivePosition?.(livePoint ? { lat: livePoint.lat, lng: livePoint.lng, station: liveStation } : null);
  }, [livePoint, liveStation, onLivePosition]);

  const encodedPath = () =>
    customPath.map(getStationId).filter((id): id is number => id !== null);

  const fetchMatchers = async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const ids = encodedPath();
      const tokens = ids.map(String);
      const idmap = new Map(tokens.map((t, i) => [t, ids[i]]));
      const sa = new SuffixAutomaton(tokens, idmap);
      const res = await api.post("/utils/path/match_trips", {
        sam: sa.serialize(),
        totalStations: customPath.length,
        startTime: new Date(tripTime).toISOString(),
        matchThreshold: MATCH_WINDOW_MINUTES,
        filters: {
          womenOnly: filters.womenOnly,
          verifiedOnly: filters.verifiedOnly,
          ageMin: filters.ageMin ? Number(filters.ageMin) : undefined,
          ageMax: filters.ageMax ? Number(filters.ageMax) : undefined,
        },
        page: p,
        limit: 10,
      });
      setMatchers(res.data.data);
      setTotalPages(res.data.totalPages || 1);
      setPage(res.data.currentPage);
      setHasSearched(true);
      setSheetOpen(true);
    } catch (err) {
      setError(errorMessage(err, "Could not load co-riders."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = async (saveToDb: boolean, repeatDays: number[]) => {
    setShowDialog(false);
    setNotice(null);
    if (saveToDb) {
      const ids = encodedPath();
      const when = new Date(tripTime);
      const trip = { stationList: ids, distanceKm: summary?.distanceKm ?? null };
      try {
        await api.post("/trips", { ...trip, startTime: when.toISOString() });
        if (repeatDays.length) {
          // India time, so the schedule matches how the server reads it.
          const ist = new Date(when.getTime() + 330 * 60000);
          await api.post("/recurring-trips", {
            ...trip,
            days: repeatDays,
            departureMinutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
          });
          setNotice("Saved as a weekly trip. Manage it from your profile.");
        } else {
          setNotice("Trip saved. Others on this route can now find you.");
        }
      } catch (err) {
        setError(`${errorMessage(err, "Trip could not be saved")}. Showing matches anyway.`);
      }
    }
    await fetchMatchers(1);
  };

  const handleAddFriend = async (e: React.MouseEvent, receiverId: string) => {
    e.stopPropagation();
    try {
      await api.post("/friendships/request", { receiverId });
      setMatchers((prev) =>
        prev.map((m) => (m.user.id === receiverId ? { ...m, friendshipStatus: "SENT_REQUEST" } : m)),
      );
    } catch (err) {
      setError(errorMessage(err, "Request not sent. You may already be connected."));
    }
  };

  /** Free-text trip ("kal subah 9 baje X se Y") → stations and time. */
  const handleSmartSearch = async (text: string): Promise<string | null> => {
    try {
      const res = await api.post("/ai/parse-trip", { text, now: localNow() });
      const { from, to, departure, source } = res.data.data as {
        from: string | null;
        to: string | null;
        departure: string | null;
        source: "ai" | "rules";
      };
      if (!from && !to) return "Couldn't find station names in that. Try “Rajiv Chowk to Noida Sector 62”.";
      const start = from && stations[from] ? from : "";
      const end = to && stations[to] ? to : "";
      changeRoute(start, end);
      if (departure) setTripTime(departure);
      const parts = [start && `from ${start}`, end && `to ${end}`, departure && `at ${new Date(departure).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`];
      return `Understood ${parts.filter(Boolean).join(" ")}${source === "ai" ? " (AI)" : ""}.${!start || !end ? " Pick the missing station." : ""}`;
    } catch (err) {
      return errorMessage(err, "Couldn't read that");
    }
  };

  const reset = () => {
    onReset();
    setDraftEnd("");
    setMatchers([]);
    setHasSearched(false);
    setError(null);
    setNotice(null);
  };

  return (
    <>
      <aside
        className={`pointer-events-auto absolute z-[1000] flex flex-col overflow-hidden border border-border bg-card/95 shadow-2xl backdrop-blur-xl transition-[max-height] duration-300
          inset-x-2 bottom-[84px] rounded-3xl ${sheetOpen ? "max-h-[calc(100dvh-160px)]" : "max-h-[7.5rem]"}
          md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:max-h-[calc(100dvh-2rem)] md:w-[400px] md:rounded-2xl`}
      >
        <button
          onClick={() => setSheetOpen((o) => !o)}
          className="flex w-full justify-center pt-2.5 md:hidden"
          aria-label={sheetOpen ? "Collapse panel" : "Expand panel"}
        >
          <span className="h-1.5 w-10 rounded-full bg-foreground/15" />
        </button>

        <div className="overflow-y-auto overscroll-contain pb-4">
          <RouteSettings
            startStation={startStation}
            endStation={endStation}
            options={options}
            onSelectStart={(name) => changeRoute(name, endStation)}
            onSelectEnd={(name) => changeRoute(startStation, name)}
            onSwap={() => changeRoute(endStation, startStation)}
            onReset={reset}
            summary={summary}
            tripTime={tripTime}
            setTripTime={setTripTime}
            isLoading={isLoading}
            canSubmit={customPath.length >= 2}
            onSubmit={() => customPath.length >= 2 && setShowDialog(true)}
            path={customPath}
            filters={filters}
            setFilters={setFilters}
            onSmartSearch={handleSmartSearch}
          />

          <JourneyPanel
            path={customPath}
            state={js}
            alarms={journey.alarms}
            onStart={(demo) => {
              setSheetOpen(true);
              void journey.start(demo);
            }}
            onStop={journey.stop}
          />

          <div className="border-t border-border px-5 pt-4">
            {error && (
              <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
            {notice && (
              <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700 dark:text-emerald-400">
                {notice}
              </p>
            )}
            <MatchersList
              hasSearched={hasSearched}
              matchers={matchers}
              page={page}
              totalPages={totalPages}
              onPageChange={fetchMatchers}
              onAddFriend={handleAddFriend}
            />
          </div>
        </div>
      </aside>

      <JourneyAlarm state={js} onDismiss={journey.dismissAlarm} />

      {showDialog && (
        <SaveTripDialog
          tripDate={new Date(tripTime)}
          onFinalSubmit={handleFinalSubmit}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}
