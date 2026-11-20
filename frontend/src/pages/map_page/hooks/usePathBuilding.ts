import { useRef, useState, useCallback } from "react";
import type { Graph } from "../types";
import { extendPath, truncatePath, validateStation } from "../utils/pathUtils";
import djikstra from "../../../utils/djikstra";

export function usePathBuilding() {
  const stationsRef = useRef<Graph>({});
  const [customPath, setCustomPath] = useState<string[]>([]);

  // Map click: first click sets start, next clicks extend, clicking a station
  // already on the route trims it back to that station.
  const handleStationClick = useCallback((name: string) => {
    setCustomPath((prev) => {
      const graph = stationsRef.current;
      if (!validateStation(name, graph)) return prev;
      if (prev.length === 0) return [name];
      if (prev.includes(name)) return truncatePath(prev, name);
      return extendPath(prev, name, graph);
    });
  }, []);

  // Typed search: build the shortest route between two stations.
  const setRoute = useCallback((start: string, end: string) => {
    const graph = stationsRef.current;
    if (start && !graph[start]) return;
    if (end && !graph[end]) return;
    if (!start) return setCustomPath(end ? [end] : []);
    if (!end || start === end) return setCustomPath([start]);
    const path = djikstra(graph, start, end);
    setCustomPath(path[0] === start ? path : [start]);
  }, []);

  const clearPath = useCallback(() => setCustomPath([]), []);

  return { customPath, handleStationClick, setRoute, clearPath, stationsRef };
}
