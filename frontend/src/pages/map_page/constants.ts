export const MAP_CONFIG = {
  // Map ka default center point (Latitude, Longitude) - Delhi focus
  CENTER: [28.6139, 77.209] as [number, number],
  // Starting zoom level (jitna bada number, utna close view)
  ZOOM: 11,
  MIN_ZOOM: 9,
  MAX_ZOOM: 18,
};

// Free basemaps that need no API key.
export const BASEMAPS = {
  light: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxNativeZoom: 16,
  },
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxNativeZoom: 16,
  },
  street: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
} as const;

export type BasemapStyle = "minimal" | "street";

export const DATA_CONFIG = {
  // Metro stations aur lines ka data file source
  METRO_DATA_URL: "/metro_data/metro_data.json",
};

export const STYLE_CONFIG = {
  // Background lines ki layering depth (sabse neeche)
  EDGES_PANE_Z_INDEX: "350",
  // Metro line ki motai
  EDGE_WEIGHT: 4,
  // Selected path ki motai
  PATH_WEIGHT: 9,
  // Selected path ki layering position (lines ke upar, stations ke neeche)
  PATH_PANE_Z_INDEX: "380",
  // Station markers lines aur path dono ke upar
  STATIONS_PANE_Z_INDEX: "420",
};

/** Station marker radius for a zoom level. */
export function markerRadius(zoom: number, interchange: boolean): number {
  const base = Math.max(2.5, (zoom - 9) * 1.1 + 2);
  return interchange ? base + 1.5 : base;
}
