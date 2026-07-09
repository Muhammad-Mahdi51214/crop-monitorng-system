"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoPolygon } from "@/lib/api";
import {
  SATELLITE_MAP_STYLE,
  attachSatelliteBasemapFallback,
} from "@/lib/satelliteMapStyle";

const DEFAULT_CENTER: [number, number] = [74.3587, 31.5204];
const DEFAULT_ZOOM = 14;

type Props = {
  boundary?: GeoPolygon;
  center?: [number, number];
  zoom?: number;
  className?: string;
  onMapReady?: (map: maplibregl.Map) => void;
};

export default function MapView({
  boundary,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  className = "h-80 w-full rounded-xl",
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_MAP_STYLE,
      center,
      zoom,
    });

    attachSatelliteBasemapFallback(map);

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    onMapReadyRef.current?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boundary) return;

    const addLayer = () => {
      const sourceId = "field-boundary";
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: boundary,
        });
        return;
      }

      map.addSource(sourceId, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: boundary },
      });

      map.addLayer({
        id: "field-fill",
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#ffffff",
          "fill-opacity": 0.15,
        },
      });

      map.addLayer({
        id: "field-outline",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#ffffff",
          "line-width": 2.5,
        },
      });

      const coords = boundary.coordinates[0];
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 40 },
      );
    };

    if (map.isStyleLoaded()) addLayer();
    else map.once("load", addLayer);
  }, [boundary]);

  return <div ref={containerRef} className={className} />;
}
