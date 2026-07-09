"""Zonal statistics for vegetation indices."""
from __future__ import annotations

import math
from statistics import mean, pstdev
from typing import Any

import numpy as np


# Thresholds aligned to methodology correction:
# NDVI: Rouse et al. (1974), NDRE: Gitelson & Merzlyak (1994), Barnes et al. (2000)
# NDMI (stored in ndwi field for API compatibility): Gao (1996), Jackson et al. (2004)
NDVI_LOW = 0.20
NDVI_GOOD = 0.50
NDRE_LOW = 0.20
NDRE_GOOD = 0.35
NDMI_STRESS = 0.0
NDMI_ADEQUATE = 0.40
SURFACE_WATER_LOW = 0.05
SURFACE_WATER_HIGH = 0.20


def zonal_mean(values: np.ndarray, valid_mask: np.ndarray) -> float:
    masked = values[valid_mask & ~np.isnan(values)]
    if masked.size == 0:
        raise ValueError("No valid pixels for zonal mean")
    return float(np.mean(masked))


def compute_zscore(current: float, series: list[float]) -> float:
    if len(series) < 2:
        return 0.0
    avg = mean(series)
    spread = pstdev(series)
    if spread == 0:
        return 0.0
    return (current - avg) / spread


def _pixel_area_m2(transform: object, crs: object, valid_mask: np.ndarray) -> float:
    rows, cols = np.where(valid_mask)
    if rows.size == 0:
        return 0.0

    if crs is not None and getattr(crs, "is_projected", False):
        return abs(float(transform.a) * float(transform.e))

    center_r = int(rows.mean())
    center_c = int(cols.mean())
    from rasterio.transform import xy

    lon, lat = xy(transform, center_r, center_c)
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat))
    return abs(float(transform.a) * m_per_deg_lon * float(transform.e) * m_per_deg_lat)


def _zone_breakdown(
    values: np.ndarray,
    valid_mask: np.ndarray,
    pixel_area_m2: float,
    *,
    low_is_below: float,
    good_is_at_or_above: float,
    low_label: str,
    moderate_label: str,
    good_label: str,
) -> dict[str, Any]:
    masked = valid_mask & ~np.isnan(values)
    total = int(np.sum(masked))
    if total == 0:
        return {
            "lowPercent": 0.0,
            "moderatePercent": 0.0,
            "goodPercent": 0.0,
            "lowAreaHa": 0.0,
            "moderateAreaHa": 0.0,
            "goodAreaHa": 0.0,
            "lowLabel": low_label,
            "moderateLabel": moderate_label,
            "goodLabel": good_label,
        }

    low = masked & (values < low_is_below)
    good = masked & (values >= good_is_at_or_above)
    moderate = masked & ~low & ~good

    ha = pixel_area_m2 / 10_000.0
    low_n = int(np.sum(low))
    mod_n = int(np.sum(moderate))
    good_n = int(np.sum(good))

    return {
        "lowPercent": round(100.0 * low_n / total, 1),
        "moderatePercent": round(100.0 * mod_n / total, 1),
        "goodPercent": round(100.0 * good_n / total, 1),
        "lowAreaHa": round(low_n * ha, 2),
        "moderateAreaHa": round(mod_n * ha, 2),
        "goodAreaHa": round(good_n * ha, 2),
        "lowLabel": low_label,
        "moderateLabel": moderate_label,
        "goodLabel": good_label,
    }


def compute_spatial_stats(
    indices: dict[str, np.ndarray],
    valid_mask: np.ndarray,
    field_mask: np.ndarray,
    transform: object,
    crs: object,
) -> dict[str, Any]:
    pixel_area_m2 = _pixel_area_m2(transform, crs, valid_mask)
    analyzed_pixels = int(np.sum(valid_mask))
    field_pixels = int(np.sum(field_mask))
    analyzed_ha = round(analyzed_pixels * pixel_area_m2 / 10_000.0, 2)
    field_ha = round(field_pixels * pixel_area_m2 / 10_000.0, 2)

    greenness = _zone_breakdown(
        indices["ndvi"],
        valid_mask,
        pixel_area_m2,
        low_is_below=NDVI_LOW,
        good_is_at_or_above=NDVI_GOOD,
        low_label="thin or stressed crop",
        moderate_label="average greenness",
        good_label="healthy green cover",
    )
    chlorophyll = _zone_breakdown(
        indices["ndre"],
        valid_mask,
        pixel_area_m2,
        low_is_below=NDRE_LOW,
        good_is_at_or_above=NDRE_GOOD,
        low_label="low leaf vigor",
        moderate_label="moderate chlorophyll",
        good_label="strong leaf vigor",
    )
    water = _zone_breakdown(
        indices["ndwi"],
        valid_mask,
        pixel_area_m2,
        low_is_below=NDMI_STRESS,
        good_is_at_or_above=NDMI_ADEQUATE,
        low_label="possible water stress",
        moderate_label="moderate moisture",
        good_label="well hydrated canopy",
    )
    surface_water = _zone_breakdown(
        indices["surface_water"],
        valid_mask,
        pixel_area_m2,
        low_is_below=SURFACE_WATER_LOW,
        good_is_at_or_above=SURFACE_WATER_HIGH,
        low_label="little standing water",
        moderate_label="possible wet patches",
        good_label="surface water / flooding signal",
    )

    concerns: list[tuple[str, float]] = [
        ("greenness", greenness["lowPercent"]),
        ("chlorophyll", chlorophyll["lowPercent"]),
        ("water", water["lowPercent"]),
    ]
    concerns.sort(key=lambda item: item[1], reverse=True)
    primary = concerns[0][0] if concerns[0][1] > 10 else "none"

    return {
        "fieldAreaHa": field_ha,
        "analyzedAreaHa": analyzed_ha,
        "greenness": greenness,
        "chlorophyll": chlorophyll,
        "waterStress": water,
        "surfaceWater": surface_water,
        "primaryConcern": primary,
    }
