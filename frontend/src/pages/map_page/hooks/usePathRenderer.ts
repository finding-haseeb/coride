import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Graph } from "../types";
import { STYLE_CONFIG } from "../constants";
import { ROUTE_COLOR } from "../metroLines";

/** Draws the selected route (with a soft halo) and frames it on the map. */
export function usePathRenderer(
  map: L.Map | null,
  routeGroup: L.LayerGroup | null,
  customPath: string[],
  stations: Graph,
  fitSignal: number,
) {
  const endpointsRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!map || !routeGroup) return;
    routeGroup.clearLayers();
    endpointsRef.current = [];

    const coords = customPath
      .filter((s) => stations[s])
      .map((s) => [stations[s].lat, stations[s].lng] as [number, number]);
    if (coords.length === 0) return;

    if (coords.length > 1) {
      L.polyline(coords, {
        color: ROUTE_COLOR,
        weight: STYLE_CONFIG.PATH_WEIGHT + 8,
        opacity: 0.18,
        lineCap: "round",
        lineJoin: "round",
        pane: "pathPane",
        interactive: false,
      }).addTo(routeGroup);
      L.polyline(coords, {
        color: ROUTE_COLOR,
        weight: STYLE_CONFIG.PATH_WEIGHT - 3,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        pane: "pathPane",
        className: "route-line-animated",
        interactive: false,
      }).addTo(routeGroup);
    }

    const pin = (latlng: [number, number], label: string, kind: "start" | "end") =>
      L.marker(latlng, {
        pane: "markerPane",
        interactive: false,
        icon: L.divIcon({
          className: "",
          html: `<div class="route-pin route-pin-${kind}"><span>${label}</span></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(routeGroup);

    endpointsRef.current.push(pin(coords[0], "A", "start"));
    if (coords.length > 1) {
      endpointsRef.current.push(pin(coords[coords.length - 1], "B", "end"));
    }
  }, [map, routeGroup, customPath, stations]);

  // Frame the route only when asked (after a typed search), not on every
  // map click, so the map does not jump while the user is clicking stations.
  useEffect(() => {
    if (!map || fitSignal === 0) return;
    const coords = customPath
      .filter((s) => stations[s])
      .map((s) => [stations[s].lat, stations[s].lng] as [number, number]);
    if (coords.length === 0) return;

    const wide = window.innerWidth >= 768;
    const frame = () => {
      map.invalidateSize();
      if (coords.length === 1) {
        // Just bring the station into view; no zoom animation to collide with.
        map.panTo(coords[0]);
        return;
      }
      map.fitBounds(L.latLngBounds(coords), {
        paddingTopLeft: [wide ? 440 : 24, wide ? 60 : 24],
        paddingBottomRight: [wide ? 80 : 24, wide ? 60 : Math.round(window.innerHeight * 0.55)],
        maxZoom: 14,
      });
    };

    // Leaflet drops a new zoom while a zoom animation is still running, so
    // wait for it to finish instead of losing the fit.
    if ((map as any)._animatingZoom) {
      map.once("zoomend", frame);
      return () => {
        map.off("zoomend", frame);
      };
    }
    frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitSignal]);
}
