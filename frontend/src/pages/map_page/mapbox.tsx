import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapOverlay from "../../components/page_based_component/map_overlay/map_overlay";
import { useMapInitialization } from "./hooks/useMapInitialization";
import { usePathBuilding } from "./hooks/usePathBuilding";
import { useStations } from "./hooks/useStations";
import { usePathRenderer } from "./hooks/usePathRenderer";
import { MapControls } from "./components/MapControls";
import { useIsDark } from "../../hooks/useIsDark";
import type { BasemapStyle } from "./constants";

export default function MapMetro() {
  const isDark = useIsDark();
  const [basemap, setBasemap] = useState<BasemapStyle>("minimal");
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(() => new Set());
  const [fitSignal, setFitSignal] = useState(0);

  const { map, containerRef, routeGroup, edgesGroup, stationsGroup } =
    useMapInitialization(basemap, isDark);

  const { customPath, handleStationClick, setRoute, clearPath, stationsRef } =
    usePathBuilding();

  const { stations, isLoading, error } = useStations({
    map,
    edgesGroup,
    stationsGroup,
    stationsRef,
    onStationClick: handleStationClick,
    hiddenLines,
    isDark,
  });

  usePathRenderer(map, routeGroup, customPath, stations, fitSignal);

  const onRouteChange = useCallback(
    (start: string, end: string) => {
      setRoute(start, end);
      setFitSignal((n) => n + 1);
    },
    [setRoute],
  );

  // Live "you are here" marker while a journey is tracked.
  const [live, setLive] = useState<{ lat: number; lng: number; station: string } | null>(null);
  const liveMarker = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    if (!live) {
      liveMarker.current?.remove();
      liveMarker.current = null;
      return;
    }
    if (!liveMarker.current) {
      liveMarker.current = L.marker([live.lat, live.lng], {
        icon: L.divIcon({
          className: "",
          html: '<span class="coride-live-dot"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 1000,
        keyboard: false,
      }).addTo(map);
    } else {
      liveMarker.current.setLatLng([live.lat, live.lng]);
    }
    liveMarker.current.bindTooltip(`You · ${live.station}`, { direction: "top", offset: [0, -12] });
  }, [map, live]);
  useEffect(() => () => void liveMarker.current?.remove(), []);

  const toggleLine = (key: string) =>
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="metro-map absolute inset-0 z-0 bg-background" />

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center">
          <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/70 shadow-lg">
            Loading metro network…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute left-1/2 top-4 z-[1100] -translate-x-1/2 rounded-full bg-rose-500 px-4 py-2 text-sm text-white shadow-lg">
          Metro data could not load
        </div>
      )}

      <MapControls
        basemap={basemap}
        onBasemapChange={setBasemap}
        hiddenLines={hiddenLines}
        onToggleLine={toggleLine}
        onShowAll={() => setHiddenLines(new Set())}
      />

      <MapOverlay
        customPath={customPath}
        stations={stations}
        onRouteChange={onRouteChange}
        onReset={clearPath}
        onLivePosition={setLive}
      />
    </div>
  );
}
