"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CaptureMetadata, GeoPolygon, FieldImagery } from "@/lib/api";
import {
  SATELLITE_MAP_STYLE,
  attachSatelliteBasemapFallback,
  boundsToCoordinates,
} from "@/lib/satelliteMapStyle";

const BOUNDARY_SOURCE = "field-boundary";
const BOUNDARY_FILL = "field-boundary-fill";
const BOUNDARY_LINE = "field-boundary-line";
const OVERLAY_SOURCE = "scene-overlay";

type Tab = "satellite" | "ndvi" | "ndre" | "ndwi";

type Props = {
  boundary: GeoPolygon;
  imagery: FieldImagery | null;
  capture?: CaptureMetadata | null;
};

function resolveImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return path.startsWith("http") ? path : `${base}${path}`;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "satellite", label: "Satellite photo" },
  { id: "ndvi", label: "Greenness" },
  { id: "ndre", label: "Chlorophyll" },
  { id: "ndwi", label: "Water stress" },
];

export default function FieldImageryPanel({
  boundary,
  imagery,
  capture,
}: Props) {
  const [tab, setTab] = useState<Tab>("satellite");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_MAP_STYLE,
      center: [74.3587, 31.5204],
      zoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const setup = () => {
      if (!map.getSource(BOUNDARY_SOURCE)) {
        map.addSource(BOUNDARY_SOURCE, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: boundary },
        });
        map.addLayer({
          id: BOUNDARY_FILL,
          type: "fill",
          source: BOUNDARY_SOURCE,
          paint: { "fill-color": "#ffffff", "fill-opacity": 0.08 },
        });
        map.addLayer({
          id: BOUNDARY_LINE,
          type: "line",
          source: BOUNDARY_SOURCE,
          paint: { "line-color": "#ffffff", "line-width": 2.5 },
        });
      }

      const coords = boundary.coordinates[0];
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, maxZoom: 17 },
      );
    };

    attachSatelliteBasemapFallback(map, setup);
    map.on("load", setup);
    if (map.isStyleLoaded()) setup();

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !imagery?.bounds) return;

    const urlMap: Record<Tab, string> = {
      satellite: imagery.satelliteUrl,
      ndvi: imagery.ndviUrl,
      ndre: imagery.ndreUrl,
      ndwi: imagery.ndwiUrl,
    };

    const imageUrl = resolveImageUrl(urlMap[tab]);
    const coordinates = boundsToCoordinates(imagery.bounds);

    const applyOverlay = () => {
      if (map.getLayer(OVERLAY_SOURCE)) map.removeLayer(OVERLAY_SOURCE);
      if (map.getSource(OVERLAY_SOURCE)) map.removeSource(OVERLAY_SOURCE);

      map.addSource(OVERLAY_SOURCE, {
        type: "image",
        url: imageUrl,
        coordinates,
      });

      map.addLayer(
        {
          id: OVERLAY_SOURCE,
          type: "raster",
          source: OVERLAY_SOURCE,
          paint: { "raster-opacity": tab === "satellite" ? 0.95 : 0.92 },
        },
        BOUNDARY_LINE,
      );
    };

    if (map.isStyleLoaded()) applyOverlay();
    else map.once("load", applyOverlay);
  }, [imagery, tab]);

  const captureTime = capture?.datetime
    ? new Date(capture.datetime).toLocaleString()
    : null;

  return (
    <section className="agro-map-panel">
      <div className="agro-map-panel-header">
        <h2 className="agro-map-panel-title">Field imagery</h2>
        <p className="agro-map-panel-subtitle">
          Real Sentinel-2 L2A imagery — clouds and shadows filtered out
        </p>

        {capture && (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="agro-stat-chip">
              <dt>Capture date & time</dt>
              <dd>{captureTime ?? "—"}</dd>
            </div>
            <div className="agro-stat-chip">
              <dt>Satellite / sensor</dt>
              <dd>
                {capture.platform ?? "Sentinel-2"} · {capture.sensor ?? "MSI"}
              </dd>
            </div>
            <div className="agro-stat-chip">
              <dt>Product</dt>
              <dd>
                {capture.productLevel ?? "L2A"} via {capture.dataSource ?? "CDSE"}
              </dd>
            </div>
            <div className="agro-stat-chip">
              <dt>Scene cloud cover</dt>
              <dd>
                {capture.cloudCoverPercent != null ? `${capture.cloudCoverPercent}%` : "—"}
              </dd>
            </div>
            <div className="agro-stat-chip">
              <dt>Clear pixels in field</dt>
              <dd>
                {capture.validPixelPercent != null ? `${capture.validPixelPercent}%` : "—"}
              </dd>
            </div>
            <div className="agro-stat-chip">
              <dt>Scene ID</dt>
              <dd className="truncate font-mono text-xs">{capture.sceneId ?? "—"}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-emerald-100/80 px-5 py-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            disabled={!imagery && t.id !== "satellite"}
            className={`agro-map-tab disabled:opacity-40 ${
              tab === t.id ? "agro-map-tab-active" : "agro-map-tab-inactive"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div ref={containerRef} className="h-[min(55vh,440px)] w-full" />

        {!imagery && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/30 to-transparent p-6">
            <p className="rounded-xl border border-emerald-200/60 bg-white/95 px-4 py-3 text-center text-sm text-emerald-900 shadow">
              Tap <strong>Refresh satellite</strong> to load a clean satellite photo
              and index maps for this field.
            </p>
          </div>
        )}

        {imagery && tab !== "satellite" && (
          <div className="absolute bottom-4 left-4 rounded-lg border border-emerald-200/60 bg-white/95 px-3 py-2 text-xs text-emerald-900 shadow">
            {tab === "ndwi" ? (
              <>
                <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-blue-500" />
                Higher water signal
                <span className="mx-2">→</span>
                <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-amber-400" />
                Possible drought stress
              </>
            ) : (
              <>
                <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-red-500" />
                Lower
                <span className="mx-2">→</span>
                <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-green-500" />
                Higher
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
