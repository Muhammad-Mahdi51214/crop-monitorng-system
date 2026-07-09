"use client";

import { useCallback, useEffect, useRef } from "react";
import { useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  SATELLITE_MAP_STYLE,
  attachSatelliteBasemapFallback,
} from "@/lib/satelliteMapStyle";

const DEFAULT_CENTER: [number, number] = [74.3587, 31.5204];
const DEFAULT_ZOOM = 14;

const DRAW_SOURCE = "field-draw";
const DRAW_FILL = "field-draw-fill";
const DRAW_LINE = "field-draw-line";
const DRAW_POINTS = "field-draw-points";

type Props = {
  points: [number, number][];
  onPointsChange: (points: [number, number][]) => void;
  className?: string;
};

type PlaceSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function buildDrawGeoJson(points: [number, number][]) {
  const features: GeoJSON.Feature[] = [];

  if (points.length >= 2) {
    const lineCoords =
      points.length >= 3 ? [...points, points[0]] : points;
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: lineCoords },
    });
  }

  if (points.length >= 3) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[...points, points[0]]],
      },
    });
  }

  for (let i = 0; i < points.length; i++) {
    features.push({
      type: "Feature",
      properties: { index: i + 1 },
      geometry: { type: "Point", coordinates: points[i] },
    });
  }

  return { type: "FeatureCollection" as const, features };
}

function ensureDrawLayers(map: maplibregl.Map) {
  if (!map.getSource(DRAW_SOURCE)) {
    map.addSource(DRAW_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: DRAW_FILL,
      type: "fill",
      source: DRAW_SOURCE,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": 0.4,
      },
    });

    map.addLayer({
      id: DRAW_LINE,
      type: "line",
      source: DRAW_SOURCE,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#ffffff",
        "line-width": 3,
        "line-dasharray": [2, 1.5],
      },
    });

    map.addLayer({
      id: DRAW_POINTS,
      type: "circle",
      source: DRAW_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 10,
        "circle-color": "#22c55e",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });
  }
}

function syncDrawData(map: maplibregl.Map, points: [number, number][]) {
  ensureDrawLayers(map);
  (map.getSource(DRAW_SOURCE) as maplibregl.GeoJSONSource).setData(
    buildDrawGeoJson(points),
  );
}

function syncNumberMarkers(
  map: maplibregl.Map,
  points: [number, number][],
  markersRef: React.MutableRefObject<maplibregl.Marker[]>,
) {
  markersRef.current.forEach((m) => m.remove());
  markersRef.current = points.map(([lng, lat], i) => {
    const el = document.createElement("div");
    el.className = "field-corner-pin";
    el.textContent = String(i + 1);
    return new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map);
  });
}

export default function FieldDrawMap({
  points,
  onPointsChange,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onPointsChangeRef = useRef(onPointsChange);
  onPointsChangeRef.current = onPointsChange;
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);

  const undo = useCallback(() => {
    onPointsChange(points.slice(0, -1));
  }, [onPointsChange, points]);

  const clearAll = useCallback(() => {
    onPointsChange([]);
  }, [onPointsChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: 18.49,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const onLoad = () => {
      syncDrawData(map, pointsRef.current);
      syncNumberMarkers(map, pointsRef.current, markersRef);
    };

    attachSatelliteBasemapFallback(map, onLoad);

    map.on("load", onLoad);
    if (map.isStyleLoaded()) onLoad();

    map.on("click", (e) => {
      const next: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      onPointsChangeRef.current([...pointsRef.current, next]);

      if (pointsRef.current.length === 0) {
        map.easeTo({ center: next, zoom: Math.max(map.getZoom(), 14), duration: 600 });
      }
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncDrawData(map, points);
    syncNumberMarkers(map, points, markersRef);
  }, [points]);

  useEffect(() => {
    const q = searchText.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as PlaceSuggestion[];
        setSuggestions(rows);
        if (!selectedPlace && rows[0]) setSelectedPlace(rows[0]);
      } catch {
        // ignore transient lookup errors
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchText, selectedPlace]);

  function goToPlace(place: PlaceSuggestion | null) {
    if (!place) return;
    const map = mapRef.current;
    if (!map) return;
    const lng = Number(place.lon);
    const lat = Number(place.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 13),
      duration: 900,
      essential: true,
    });
    setSearchOpen(false);
  }

  const cornersNeeded = Math.max(0, 3 - points.length);
  const isReady = points.length >= 3;

  return (
    <div className={`field-draw-shell ${className}`}>
      <div
        ref={containerRef}
        className="field-draw-map h-full w-full rounded-2xl"
        aria-label="Field boundary drawing map"
      />

      <div className="field-draw-banner">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 text-slate-500" aria-hidden>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#1A1F1C]">
              {isReady
                ? "Outline looks good!"
                : "Tap each corner of your field on the map"}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-[#5C6B63]">
              {isReady
                ? "Green area shows your field. Undo a corner or save when ready."
                : "Place at least 3 corners — like tracing the edges of your plot."}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            isReady
              ? "bg-[#E3F2E5] text-[#1E7A34]"
              : "bg-[#FCEFD9] text-[#A86510]"
          }`}
        >
          {isReady ? `${points.length} corners` : `${points.length} / 3 corners`}
        </span>
      </div>

      <div className="absolute right-2 top-2 z-[3] w-[min(320px,calc(100%-20px))]">
        <div className="rounded-lg border border-[#D9E0DB] bg-white/95 p-1.5 shadow-md">
          <div className="flex items-center gap-1.5">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search place..."
              className="min-w-0 flex-1 rounded-md border border-[#D9E0DB] px-2.5 py-1.5 text-xs text-[#1A1F1C] outline-none focus:border-[#2A7D82] focus:ring-2 focus:ring-[#2A7D82]/20"
            />
            <button
              type="button"
              onClick={() => goToPlace(selectedPlace ?? suggestions[0] ?? null)}
              className="rounded-md bg-[#1E7A34] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-[#155C27]"
              title="Go to place"
              aria-label="Go to place"
            >
              →
            </button>
          </div>
          {searchOpen && (searchText.trim().length >= 2 || suggestions.length > 0) && (
            <div className="mt-1.5 max-h-44 overflow-y-auto rounded-md border border-[#D9E0DB] bg-white">
              {searching && (
                <p className="px-2.5 py-2 text-xs text-[#5C6B63]">Searching...</p>
              )}
              {!searching && suggestions.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-[#5C6B63]">No matches found</p>
              )}
              {!searching &&
                suggestions.map((place) => (
                  <button
                    key={place.place_id}
                    type="button"
                    onClick={() => {
                      setSelectedPlace(place);
                      setSearchText(place.display_name);
                      goToPlace(place);
                    }}
                    className="block w-full border-b border-[#EEF2EF] px-2.5 py-2 text-left text-xs text-[#1A1F1C] transition-colors duration-150 last:border-b-0 hover:bg-[#F1F3F1]"
                    title={place.display_name}
                  >
                    {place.display_name}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="field-draw-toolbar">
        <button
          type="button"
          onClick={undo}
          disabled={points.length === 0}
          className="field-draw-btn"
          title="Remove last corner"
        >
          Undo last
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={points.length === 0}
          className="field-draw-btn field-draw-btn-muted"
          title="Start over"
        >
          Clear all
        </button>
        <span className="ml-auto hidden text-xs text-[#5C6B63] sm:inline">
          {isReady
            ? "Ready to save"
            : cornersNeeded === 1
              ? "1 more corner needed"
              : `${cornersNeeded} more corners needed`}
        </span>
      </div>

      {points.length > 0 && points.length < 3 && (
        <div className="field-draw-hint">
          Corner {points.length} placed — tap the next one
        </div>
      )}
    </div>
  );
}
