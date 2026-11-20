import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Graph, StationsResult } from "../types";
import { fetchStations } from "../utils/stationDataUtils";
import { markerRadius } from "../constants";
import { INTERCHANGE_KEY, edgeLine, lineColor, lineName } from "../metroLines";

interface UseStationsParams {
  map: L.Map | null;
  edgesGroup: L.LayerGroup | null;
  stationsGroup: L.LayerGroup | null;
  stationsRef: React.RefObject<Graph>;
  onStationClick: (name: string) => void;
  hiddenLines: Set<string>;
  isDark: boolean;
}

/** Lines serving a station; interchanges take their neighbours' lines. */
export function stationLines(name: string, graph: Graph): string[] {
  const info = graph[name];
  if (!info) return [];
  if (info.line !== INTERCHANGE_KEY) return [info.line];
  const set = new Set<string>();
  for (const n of Object.keys(info.neighbors)) {
    const l = graph[n]?.line;
    if (l && l !== INTERCHANGE_KEY) set.add(l);
  }
  return set.size ? [...set] : [INTERCHANGE_KEY];
}

interface StationMarker {
  marker: L.CircleMarker;
  name: string;
  line: string;
}

interface EdgeLayer {
  polyline: L.Polyline;
  line: string;
}

export function useStations({
  map,
  edgesGroup,
  stationsGroup,
  stationsRef,
  onStationClick,
  hiddenLines,
  isDark,
}: UseStationsParams): StationsResult {
  const [stations, setStations] = useState<Graph>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const markersRef = useRef<StationMarker[]>([]);
  const edgesRef = useRef<EdgeLayer[]>([]);
  const clickRef = useRef(onStationClick);
  clickRef.current = onStationClick;

  // Load data once and draw lines + stations.
  useEffect(() => {
    if (!map || !edgesGroup || !stationsGroup) return;
    let aborted = false;

    fetchStations()
      .then((graph) => {
        if (aborted) return;
        stationsRef.current = graph;
        setStations(graph);

        const added = new Set<string>();
        for (const [from, info] of Object.entries(graph)) {
          for (const to of Object.keys(info.neighbors)) {
            const key = [from, to].sort().join("|");
            if (added.has(key) || !graph[to]) continue;
            added.add(key);
            const line = edgeLine(info.line, graph[to].line) ?? INTERCHANGE_KEY;
            const polyline = L.polyline(
              [
                [info.lat, info.lng],
                [graph[to].lat, graph[to].lng],
              ],
              {
                color: lineColor(line),
                weight: 4,
                opacity: 0.9,
                lineCap: "round",
                pane: "edgesPane",
                interactive: false,
              },
            ).addTo(edgesGroup);
            edgesRef.current.push({ polyline, line });
          }
        }

        const zoom = map.getZoom();
        for (const [name, info] of Object.entries(graph)) {
          const interchange = info.line === INTERCHANGE_KEY;
          const lines = stationLines(name, graph);
          const dots = lines
            .map(
              (l) =>
                `<span class="station-tip-line"><i style="background:${lineColor(l)}"></i>${lineName(l)}</span>`,
            )
            .join("");
          const marker = L.circleMarker([info.lat, info.lng], {
            radius: markerRadius(zoom, interchange),
            color: interchange ? lineColor(INTERCHANGE_KEY) : lineColor(info.line),
            weight: interchange ? 2.5 : 2,
            fillColor: "#ffffff",
            fillOpacity: 1,
            pane: "stationsPane",
          })
            .bindTooltip(
              `<div class="station-tip"><strong>${name}</strong>${dots}</div>`,
              { direction: "top", offset: [0, -6], className: "station-tooltip" },
            )
            .on("click", () => clickRef.current(name))
            .addTo(stationsGroup);
          markersRef.current.push({ marker, name, line: info.line });
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (aborted) return;
        console.error("Error loading metro data:", err);
        setError(err);
        setIsLoading(false);
      });

    const onZoom = () => {
      const z = map.getZoom();
      for (const { marker, line } of markersRef.current) {
        marker.setRadius(markerRadius(z, line === INTERCHANGE_KEY));
      }
    };
    map.on("zoomend", onZoom);

    return () => {
      aborted = true;
      map.off("zoomend", onZoom);
      edgesGroup.clearLayers();
      stationsGroup.clearLayers();
      markersRef.current = [];
      edgesRef.current = [];
    };
  }, [map, edgesGroup, stationsGroup, stationsRef]);

  // Dim lines the user has hidden in the legend.
  useEffect(() => {
    const anyHidden = hiddenLines.size > 0;
    for (const { polyline, line } of edgesRef.current) {
      const hidden = hiddenLines.has(line);
      polyline.setStyle({ opacity: hidden ? 0.08 : anyHidden ? 1 : 0.9 });
    }
    for (const { marker, line } of markersRef.current) {
      const hidden = line !== INTERCHANGE_KEY && hiddenLines.has(line);
      marker.setStyle({ opacity: hidden ? 0.15 : 1, fillOpacity: hidden ? 0.15 : 1 });
    }
  }, [hiddenLines, stations]);

  // Station fill follows the theme.
  useEffect(() => {
    const fill = isDark ? "#0b1220" : "#ffffff";
    for (const { marker } of markersRef.current) marker.setStyle({ fillColor: fill });
  }, [isDark, stations]);

  return { stations, isLoading, error };
}
