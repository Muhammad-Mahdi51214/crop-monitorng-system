import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";

const MAPLIBRE_GLYPHS =
  "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

function createEsriSatelliteStyle(host: string): StyleSpecification {
  return {
    version: 8,
    glyphs: MAPLIBRE_GLYPHS,
    sources: {
      "esri-satellite": {
        type: "raster",
        tiles: [
          `https://${host}/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
        ],
        tileSize: 256,
        attribution:
          "Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, AeroGRID, IGN, IGP",
      },
    },
    layers: [
      {
        id: "esri-satellite",
        type: "raster",
        source: "esri-satellite",
      },
    ],
  };
}

/** Sentinel-2 cloudless mosaic — satellite fallback when Esri is unreachable */
export const EOX_SATELLITE_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: MAPLIBRE_GLYPHS,
  sources: {
    "eox-s2": {
      type: "raster",
      tiles: [
        "https://tiles.maps.eox.at/wms?service=WMS&version=1.1.1&request=GetMap&layers=s2cloudless-2023&styles=&format=image/jpeg&transparent=false&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}",
      ],
      tileSize: 256,
      attribution: "Sentinel-2 cloudless © EOX IT Services GmbH",
    },
  },
  layers: [
    {
      id: "eox-s2",
      type: "raster",
      source: "eox-s2",
    },
  ],
};

/** Esri World Imagery — primary satellite basemap */
export const ESRI_SATELLITE_MAP_STYLE = createEsriSatelliteStyle(
  "services.arcgisonline.com",
);

/** Alternate Esri host if services.* is blocked */
export const ESRI_SERVER_SATELLITE_MAP_STYLE = createEsriSatelliteStyle(
  "server.arcgisonline.com",
);

/** Default satellite basemap for all maps */
export const SATELLITE_MAP_STYLE = ESRI_SATELLITE_MAP_STYLE;

const SATELLITE_FALLBACK_CHAIN: StyleSpecification[] = [
  ESRI_SATELLITE_MAP_STYLE,
  ESRI_SERVER_SATELLITE_MAP_STYLE,
  EOX_SATELLITE_MAP_STYLE,
];

/**
 * If the current satellite provider fails to load tiles, try the next
 * satellite source (never falls back to street maps).
 */
export function attachSatelliteBasemapFallback(
  map: MaplibreMap,
  onStyleReload?: () => void,
) {
  let fallbackIndex = 0;

  map.on("error", (event) => {
    const message = String(event.error?.message ?? "");
    if (
      !message.includes("Failed to fetch") &&
      !message.includes("AJAXError")
    ) {
      return;
    }

    const next = fallbackIndex + 1;
    if (next >= SATELLITE_FALLBACK_CHAIN.length) return;

    fallbackIndex = next;
    map.setStyle(SATELLITE_FALLBACK_CHAIN[fallbackIndex]);
    if (onStyleReload) {
      map.once("load", onStyleReload);
    }
  });
}

export type ImageBounds = [number, number, number, number]; // west, south, east, north

export function parseImageBounds(
  bounds: ImageBounds | string | null | undefined,
): ImageBounds | null {
  if (!bounds) return null;
  if (Array.isArray(bounds) && bounds.length === 4) {
    const nums = bounds.map(Number);
    if (nums.every((n) => Number.isFinite(n))) return nums as ImageBounds;
  }
  if (typeof bounds === "string") {
    const nums = bounds
      .replace(/[()[\]]/g, "")
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    if (nums.length === 4) return nums as ImageBounds;
  }
  return null;
}

export function boundsToCoordinates(
  bounds: ImageBounds | string,
): [[number, number], [number, number], [number, number], [number, number]] {
  const parsed = typeof bounds === "string" ? parseImageBounds(bounds) : bounds;
  if (!parsed) {
    throw new Error("Invalid image bounds");
  }
  const [west, south, east, north] = parsed;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}
