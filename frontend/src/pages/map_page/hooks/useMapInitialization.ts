import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { BASEMAPS, MAP_CONFIG, STYLE_CONFIG, type BasemapStyle } from "../constants";

export function useMapInitialization(basemap: BasemapStyle, isDark: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [map, setMap] = useState<L.Map | null>(null);
  const [routeGroup, setRouteGroup] = useState<L.LayerGroup | null>(null);
  const [edgesGroup, setEdgesGroup] = useState<L.LayerGroup | null>(null);
  const [stationsGroup, setStationsGroup] = useState<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if container already has a map (prevents StrictMode double init)
    const container = containerRef.current;
    if ((container as any)._leaflet_id) return;

    const newMap = L.map(container, {
      zoomControl: false,
      minZoom: MAP_CONFIG.MIN_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM,
      preferCanvas: false,
    }).setView(MAP_CONFIG.CENTER, MAP_CONFIG.ZOOM);

    L.control.zoom({ position: "bottomright" }).addTo(newMap);
    newMap.attributionControl.setPrefix(false);

    const pane = (name: string, z: string) => {
      newMap.createPane(name);
      newMap.getPane(name)!.style.zIndex = z;
    };
    pane("edgesPane", STYLE_CONFIG.EDGES_PANE_Z_INDEX);
    pane("pathPane", STYLE_CONFIG.PATH_PANE_Z_INDEX);
    pane("stationsPane", STYLE_CONFIG.STATIONS_PANE_Z_INDEX);

    setEdgesGroup(L.layerGroup([], { pane: "edgesPane" }).addTo(newMap));
    setRouteGroup(L.layerGroup([], { pane: "pathPane" }).addTo(newMap));
    setStationsGroup(L.layerGroup([], { pane: "stationsPane" }).addTo(newMap));
    setMap(newMap);

    // Keep Leaflet's idea of the container size correct (tab switches,
    // sidebar/panel layout changes, phone rotation).
    const resizeObserver = new ResizeObserver(() => newMap.invalidateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      newMap.remove();
      tileLayerRef.current = null;
    };
  }, []);

  // Swap the basemap when the style or theme changes.
  useEffect(() => {
    if (!map) return;
    const spec =
      basemap === "street" ? BASEMAPS.street : isDark ? BASEMAPS.dark : BASEMAPS.light;
    const layer = L.tileLayer(spec.url, {
      attribution: spec.attribution,
      maxNativeZoom: spec.maxNativeZoom,
      maxZoom: MAP_CONFIG.MAX_ZOOM,
    }).addTo(map);
    tileLayerRef.current?.remove();
    tileLayerRef.current = layer;
  }, [map, basemap, isDark]);

  return { map, containerRef, routeGroup, edgesGroup, stationsGroup };
}
