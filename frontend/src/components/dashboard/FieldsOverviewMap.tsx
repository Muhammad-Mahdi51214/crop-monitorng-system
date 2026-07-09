"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapLayerType, MapOverviewField } from "@/lib/api";
import {
  SATELLITE_MAP_STYLE,
  attachSatelliteBasemapFallback,
  boundsToCoordinates,
  parseImageBounds,
} from "@/lib/satelliteMapStyle";

const FIELDS_SOURCE = "all-fields";
const FIELDS_FILL = "all-fields-fill";
const FIELDS_LINE = "all-fields-line";

const MAP_HEIGHT_CLASS = "h-[min(52vh,480px)] min-h-[360px]";

function boundsFromField(field: MapOverviewField) {
  return boundsFromFields([field]);
}

function flyToField(map: maplibregl.Map, field: MapOverviewField) {
  const bounds = boundsFromField(field);
  if (!bounds) return;
  map.fitBounds(bounds, {
    padding: { top: 140, bottom: 180, left: 120, right: 160 },
    maxZoom: 14,
    duration: 1600,
    essential: true,
  });
}

function FocusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

const CROP_COLORS: Record<string, string> = {
  wheat: "#ca8a04",
  rice: "#16a34a",
  cotton: "#64748b",
  maize: "#ea580c",
  other: "#7c3aed",
};

const LAYER_TABS: { id: MapLayerType; label: string }[] = [
  { id: "satellite", label: "Satellite" },
  { id: "ndvi", label: "Greenness" },
  { id: "ndre", label: "Chlorophyll" },
  { id: "ndwi", label: "Water stress" },
];

function cropColor(cropType: string) {
  return CROP_COLORS[cropType.toLowerCase()] ?? CROP_COLORS.other;
}

function resolveImageUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return path.startsWith("http") ? path : `${base}${path}`;
}

function overlayIds(fieldId: string) {
  return {
    source: `field-overlay-${fieldId}`,
    layer: `field-overlay-layer-${fieldId}`,
  };
}

function boundsFromFields(fields: MapOverviewField[]) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const field of fields) {
    const ring = field.boundary?.coordinates?.[0];
    if (!ring?.length) continue;
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }

  if (!Number.isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as [[number, number], [number, number]];
}

function ensureFieldLayers(map: maplibregl.Map) {
  if (map.getSource(FIELDS_SOURCE)) {
    map.setPaintProperty(FIELDS_FILL, "fill-opacity", 0);
    map.setPaintProperty(FIELDS_LINE, "line-width", [
      "case",
      ["get", "selected"],
      3.5,
      2.5,
    ]);
    return;
  }

  map.addSource(FIELDS_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: FIELDS_FILL,
    type: "fill",
    source: FIELDS_SOURCE,
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0,
    },
  });
  map.addLayer({
    id: FIELDS_LINE,
    type: "line",
    source: FIELDS_SOURCE,
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", ["get", "selected"], 3.5, 2.5],
    },
  });
}

type Props = {
  fields: MapOverviewField[];
  selectedId: string | null;
  onSelectField: (id: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  fillHeight?: boolean;
  embedded?: boolean;
  focusRequest?: { id: string; at: number } | null;
  mapActive?: boolean;
};

export default function FieldsOverviewMap({
  fields,
  selectedId,
  onSelectField,
  onRefresh,
  refreshing,
  fillHeight,
  embedded,
  focusRequest,
  mapActive = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelectField);
  onSelectRef.current = onSelectField;
  const handlersBoundRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const flyToFieldRef = useRef<(id: string) => void>(() => {});
  const pendingFocusRef = useRef<string | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>("satellite");
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(fields.map((f) => f.id)),
  );
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const visibleFields = useMemo(
    () => fields.filter((f) => visibleIds.has(f.id)),
    [fields, visibleIds],
  );

  const mapDataRef = useRef({
    visibleFields,
    activeLayer,
    fields,
    selectedId,
  });
  mapDataRef.current = { visibleFields, activeLayer, fields, selectedId };

  const cropLegend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const field of fields) {
      const key = field.cropType.toLowerCase();
      if (!seen.has(key)) seen.set(key, cropColor(field.cropType));
    }
    return Array.from(seen.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [fields]);

  useEffect(() => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      for (const field of fields) next.add(field.id);
      return next;
    });
  }, [fields]);

  useEffect(() => {
    if (!mapActive || !mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => map.resize());
  }, [mapActive, mapReady]);

  function applyMapData(map: maplibregl.Map) {
    const { visibleFields: visible, activeLayer: layer, fields: all, selectedId: selected } =
      mapDataRef.current;

    ensureFieldLayers(map);

    const geojson = {
      type: "FeatureCollection" as const,
      features: visible.map((field) => ({
        type: "Feature" as const,
        properties: {
          id: field.id,
          name: field.name,
          cropType: field.cropType,
          color: cropColor(field.cropType),
          selected: field.id === selected,
        },
        geometry: field.boundary,
      })),
    };

    const source = map.getSource(FIELDS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(geojson);

    for (const field of all) {
      const { source: srcId, layer: layerId } = overlayIds(field.id);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(srcId)) map.removeSource(srcId);
    }

    for (const field of visible) {
      const bounds = parseImageBounds(field.imagery?.bounds);
      if (!field.imagery || !bounds) continue;

      const urlMap = {
        satellite: field.imagery.satelliteUrl,
        ndvi: field.imagery.ndviUrl,
        ndre: field.imagery.ndreUrl,
        ndwi: field.imagery.ndwiUrl,
      };

      const { source: srcId, layer: layerId } = overlayIds(field.id);
      map.addSource(srcId, {
        type: "image",
        url: resolveImageUrl(urlMap[layer]),
        coordinates: boundsToCoordinates(bounds),
      });

      map.addLayer(
        {
          id: layerId,
          type: "raster",
          source: srcId,
          paint: { "raster-opacity": layer === "satellite" ? 0.92 : 0.88 },
        },
        FIELDS_FILL,
      );
    }

    const fitList = visible.length ? visible : all;
    if (!initialFitDoneRef.current && fitList.length) {
      const bounds = boundsFromFields(fitList);
      if (bounds) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 500 });
        initialFitDoneRef.current = true;
      }
    }
  }

  flyToFieldRef.current = (id: string) => {
    const map = mapRef.current;
    if (!map) return;
    const field = mapDataRef.current.fields.find((f) => f.id === id);
    if (field) flyToField(map, field);
  };

  function focusOnField(id: string, select = true) {
    pendingFocusRef.current = id;
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (select) onSelectField(id);
  }

  useEffect(() => {
    if (!pendingFocusRef.current || !mapReady) return;
    const id = pendingFocusRef.current;
    pendingFocusRef.current = null;
    flyToFieldRef.current(id);
  }, [visibleIds, mapReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;

    const map = new maplibregl.Map({
      container,
      style: SATELLITE_MAP_STYLE,
      center: [74.3587, 31.5204],
      zoom: 10,
      maxZoom: 18.49,
    });

    mapRef.current = map;
    map.doubleClickZoom.disable();
    map.addControl(
      new maplibregl.NavigationControl(),
      embedded ? "top-right" : "bottom-right",
    );

    const onMapReady = () => {
      if (cancelled) return;
      map.resize();
      applyMapData(map);

      if (!handlersBoundRef.current) {
        handlersBoundRef.current = true;

        const handlePolygonSelect = (e: maplibregl.MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectRef.current(id);
        };

        const handlePolygonFocus = (e: maplibregl.MapLayerMouseEvent) => {
          e.preventDefault();
          if (e.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
          }
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") {
            pendingFocusRef.current = id;
            setVisibleIds((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            });
            flyToFieldRef.current(id);
            onSelectRef.current(id);
          }
        };

        map.on("click", FIELDS_FILL, handlePolygonSelect);
        map.on("click", FIELDS_LINE, handlePolygonSelect);
        map.on("dblclick", FIELDS_FILL, handlePolygonFocus);
        map.on("dblclick", FIELDS_LINE, handlePolygonFocus);
        map.on("mouseenter", FIELDS_FILL, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseenter", FIELDS_LINE, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", FIELDS_FILL, () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseleave", FIELDS_LINE, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setMapReady(true);
    };

    attachSatelliteBasemapFallback(map, onMapReady);
    map.once("load", onMapReady);

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.isStyleLoaded()) applyMapData(map);
    else map.once("load", () => applyMapData(map));
  }, [visibleFields, selectedId, fields, activeLayer, mapReady]);

  useEffect(() => {
    if (!focusRequest?.id || !mapReady) return;
    focusOnField(focusRequest.id);
  }, [focusRequest?.at, focusRequest?.id, mapReady]);

  function toggleField(id: string) {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const activeTab = LAYER_TABS.find((t) => t.id === activeLayer);
  const mapAreaClass = fillHeight
    ? "relative min-h-0 w-full flex-1"
    : `relative w-full ${MAP_HEIGHT_CLASS}`;

  const mapChrome = (
    <>
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-3">
        <div
          className={
            embedded ? "agro-map-segment pointer-events-auto" : "pointer-events-auto flex flex-wrap justify-center gap-1.5 rounded-xl border border-emerald-200/70 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
          }
        >
          {LAYER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveLayer(tab.id)}
              className={
                embedded
                  ? `agro-map-segment-btn ${activeLayer === tab.id ? "agro-map-segment-btn-active" : ""}`
                  : `agro-map-tab ${activeLayer === tab.id ? "agro-map-tab-active" : "agro-map-tab-inactive"}`
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`absolute z-10 ${embedded ? "right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2" : "right-3 top-14"}`}>
        <button
          type="button"
          onClick={() => setLayersOpen((o) => !o)}
          className={
            embedded
              ? "agro-map-float-btn"
              : "rounded-lg border border-emerald-200/70 bg-white/95 px-3 py-2 text-sm font-medium text-emerald-900 shadow-lg backdrop-blur-sm"
          }
          aria-label="Toggle field layers"
          title="Field layers"
        >
          {embedded ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h12M6 12h12M6 18h12" />
            </svg>
          ) : (
            `Layers (${visibleIds.size}/${fields.length})`
          )}
        </button>

        {layersOpen && (
          <div
            className={`agro-layers-dropdown overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-2 shadow-xl ${
              embedded ? "absolute right-12 top-0 max-h-72 w-64" : "mt-2 max-h-64 w-64"
            }`}
          >
              <div className="mb-2 border-b border-emerald-100 pb-2">
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                    onClick={() => setVisibleIds(new Set(fields.map((f) => f.id)))}
                  >
                    Show all
                  </button>
                  <span className="text-emerald-300">|</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                    onClick={() => {
                      if (fields[0]) setVisibleIds(new Set([fields[0].id]));
                    }}
                  >
                    Hide others
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Click a field name or → to zoom · double-click polygon on map
                </p>
              </div>
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`flex items-start gap-1 rounded-lg px-1 py-1 hover:bg-emerald-50 ${
                    selectedId === field.id ? "bg-emerald-50/80" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visibleIds.has(field.id)}
                    onChange={() => toggleField(field.id)}
                    className="mt-2.5 accent-emerald-600"
                    aria-label={`Show ${field.name} on map`}
                  />
                  <button
                    type="button"
                    onClick={() => focusOnField(field.id)}
                    onDoubleClick={() => focusOnField(field.id)}
                    className="min-w-0 flex-1 rounded-md px-1 py-2 text-left"
                    title="Zoom to this field"
                  >
                    <span className="block truncate text-sm font-medium text-emerald-950">
                      {field.name}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs capitalize text-emerald-700">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cropColor(field.cropType) }}
                      />
                      {field.cropType}
                      {!field.imagery && (
                        <span className="text-amber-700">· no imagery</span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => focusOnField(field.id)}
                    className="agro-map-focus-btn mt-1.5 shrink-0"
                    title="Zoom to field"
                    aria-label={`Zoom to ${field.name}`}
                  >
                    <FocusIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`pointer-events-none absolute z-10 max-w-[220px] ${
            embedded ? "bottom-5 left-5" : "bottom-3 left-3"
          }`}
        >
          <div className="agro-map-legend pointer-events-auto">
            <p className="agro-map-legend-title">
              {embedded ? "Field crops" : (activeTab?.label ?? "Legend")}
            </p>

            <ul className="space-y-1.5">
              {cropLegend.map(([crop, color]) => (
                <li
                  key={crop}
                  className="flex items-center gap-2.5 text-sm capitalize text-slate-700"
                >
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  {crop}
                </li>
              ))}
            </ul>

            {activeLayer !== "satellite" && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-500">Index scale</p>
                {activeLayer === "ndwi" ? (
                  <p className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
                    <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />
                    stressed →
                    <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" />
                    hydrated
                  </p>
                ) : (
                  <p className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
                    <span className="inline-block h-3 w-3 rounded-sm bg-red-500" />
                    low →
                    <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
                    high
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {fields.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60">
            <p className="text-sm text-emerald-800">Add a field to see it on the map.</p>
          </div>
        )}
    </>
  );

  if (embedded) {
    return (
      <section className={`agro-map-embed flex h-full min-h-0 flex-col ${fillHeight ? "flex-1" : ""}`}>
        <div className={mapAreaClass}>{mapChrome}</div>
      </section>
    );
  }

  return (
    <section className={`agro-map-panel flex flex-col ${fillHeight ? "h-full min-h-0" : ""}`}>
      <div className="agro-map-panel-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="agro-map-panel-title">Field map overview</h2>
          <p className="agro-map-panel-subtitle">
            Double-click a field or layer to zoom in · toggle layers per field
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || !selectedId}
            className="agro-btn-primary shrink-0 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh satellite"}
          </button>
        )}
      </div>
      <div className={mapAreaClass}>{mapChrome}</div>
    </section>
  );
}
