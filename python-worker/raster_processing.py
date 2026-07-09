"""Vegetation index computation and image export."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from cloud_masking import get_valid_pixel_mask


def compute_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    red = red.astype("float32")
    nir = nir.astype("float32")
    denom = nir + red
    valid = denom != 0
    ndvi = np.full(red.shape, np.nan, dtype="float32")
    ndvi[valid] = (nir[valid] - red[valid]) / denom[valid]
    return ndvi


def compute_ndre(red_edge: np.ndarray, nir: np.ndarray) -> np.ndarray:
    red_edge = red_edge.astype("float32")
    nir = nir.astype("float32")
    denom = nir + red_edge
    valid = denom != 0
    ndre = np.full(red_edge.shape, np.nan, dtype="float32")
    ndre[valid] = (nir[valid] - red_edge[valid]) / denom[valid]
    return ndre


def compute_ndwi(green: np.ndarray, nir: np.ndarray) -> np.ndarray:
    green = green.astype("float32")
    nir = nir.astype("float32")
    denom = green + nir
    valid = denom != 0
    ndwi = np.full(green.shape, np.nan, dtype="float32")
    ndwi[valid] = (green[valid] - nir[valid]) / denom[valid]
    return ndwi


def compute_ndmi(nir: np.ndarray, swir1: np.ndarray) -> np.ndarray:
    nir = nir.astype("float32")
    swir1 = swir1.astype("float32")
    denom = nir + swir1
    valid = denom != 0
    ndmi = np.full(nir.shape, np.nan, dtype="float32")
    ndmi[valid] = (nir[valid] - swir1[valid]) / denom[valid]
    return ndmi


def apply_analysis_mask(
    arrays: dict[str, np.ndarray],
    valid_mask: np.ndarray,
) -> dict[str, np.ndarray]:
    """Set invalid pixels to NaN across all bands/indices."""
    out: dict[str, np.ndarray] = {}
    for key, arr in arrays.items():
        masked = arr.astype("float32").copy()
        masked[~valid_mask] = np.nan
        out[key] = masked
    return out


def stretch_band(band: np.ndarray, valid_mask: np.ndarray) -> np.ndarray:
    valid = band[valid_mask & ~np.isnan(band)]
    if valid.size == 0:
        return np.zeros(band.shape, dtype="float32")
    low, high = np.percentile(valid, (2, 98))
    if high <= low:
        high = low + 1.0
    stretched = (band - low) / (high - low)
    stretched = np.clip(stretched, 0, 1)
    stretched[~valid_mask] = np.nan
    return stretched


def index_to_rgb(values: np.ndarray, valid_mask: np.ndarray, mode: str) -> np.ndarray:
    """Colormap index raster to RGB uint8. Invalid pixels -> neutral gray."""
    v = np.array(values, dtype="float32")
    h, w = v.shape
    rgb = np.full((h, w, 3), 210, dtype=np.uint8)  # neutral background

    def normalize_dynamic(
        arr: np.ndarray,
        mask: np.ndarray,
        *,
        q_low: float,
        q_high: float,
        min_span: float,
        clip_min: float,
        clip_max: float,
        default_low: float,
        default_high: float,
    ) -> np.ndarray:
        vals = arr[mask & ~np.isnan(arr)]
        if vals.size < 20:
            low = default_low
            high = default_high
        else:
            low = float(np.percentile(vals, q_low))
            high = float(np.percentile(vals, q_high))
            low = max(low, clip_min)
            high = min(high, clip_max)
            if high - low < min_span:
                center = (high + low) * 0.5
                half = min_span * 0.5
                low = max(center - half, clip_min)
                high = min(center + half, clip_max)
                if high - low < min_span:
                    low = default_low
                    high = default_high
        return np.clip((np.nan_to_num(arr, nan=default_low) - low) / (high - low), 0, 1)

    if mode == "ndvi":
        normed = np.clip((np.nan_to_num(v, nan=0.2) - 0.05) / 0.75, 0, 1)
        r = np.where(normed < 0.5, 1.0, 1.0 - (normed - 0.5) * 2.0)
        g = np.where(normed < 0.5, normed * 2.0, 1.0)
        b = np.zeros_like(normed)
    elif mode == "ndre":
        # NDRE can be visually flat on uniform canopies: use percentile stretch.
        normed = normalize_dynamic(
            v,
            valid_mask,
            q_low=5,
            q_high=95,
            min_span=0.12,
            clip_min=-0.1,
            clip_max=0.6,
            default_low=0.12,
            default_high=0.42,
        )
        r = np.where(normed < 0.5, 1.0, 1.0 - (normed - 0.5) * 2.0)
        g = np.where(normed < 0.5, normed * 2.0, 1.0)
        b = np.zeros_like(normed)
    elif mode == "ndmi":
        # NDMI water stress: low (dry) -> orange, high (hydrated) -> blue
        normed = normalize_dynamic(
            v,
            valid_mask,
            q_low=5,
            q_high=95,
            min_span=0.16,
            clip_min=-0.5,
            clip_max=0.7,
            default_low=-0.15,
            default_high=0.45,
        )
        r = 0.95 - normed * 0.75
        g = 0.55 + normed * 0.2
        b = 0.15 + normed * 0.8
    else:  # McFeeters NDWI (surface water / flooding signal)
        normed = np.clip((np.nan_to_num(v, nan=0.0) + 0.3) / 0.8, 0, 1)
        r = 0.1 + (1.0 - normed) * 0.1
        g = 0.25 + normed * 0.35
        b = 0.35 + normed * 0.55

    mask = valid_mask & ~np.isnan(v)
    rgb[mask, 0] = (r[mask] * 255).astype(np.uint8)
    rgb[mask, 1] = (g[mask] * 255).astype(np.uint8)
    rgb[mask, 2] = (b[mask] * 255).astype(np.uint8)
    return rgb


def satellite_rgb(
    red: np.ndarray,
    green: np.ndarray,
    blue: np.ndarray,
    valid_mask: np.ndarray,
) -> np.ndarray:
    h, w = red.shape
    rgb = np.full((h, w, 3), 210, dtype=np.uint8)
    r = stretch_band(red, valid_mask)
    g = stretch_band(green, valid_mask)
    b = stretch_band(blue, valid_mask)
    mask = valid_mask & ~(np.isnan(r) | np.isnan(g) | np.isnan(b))
    rgb[mask, 0] = (r[mask] * 255).astype(np.uint8)
    rgb[mask, 1] = (g[mask] * 255).astype(np.uint8)
    rgb[mask, 2] = (b[mask] * 255).astype(np.uint8)
    return rgb


def save_png(rgb: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb).save(path, format="PNG")


def export_imagery(
    bands: dict[str, np.ndarray],
    indices: dict[str, np.ndarray],
    valid_mask: np.ndarray,
    output_dir: Path,
) -> dict[str, Any]:
    satellite = satellite_rgb(
        bands["red"], bands["green"], bands["blue"], valid_mask
    )
    ndvi_rgb = index_to_rgb(indices["ndvi"], valid_mask, "ndvi")
    ndre_rgb = index_to_rgb(indices["ndre"], valid_mask, "ndre")
    ndwi_rgb = index_to_rgb(indices["ndwi"], valid_mask, "ndmi")

    save_png(satellite, output_dir / "satellite.png")
    save_png(ndvi_rgb, output_dir / "ndvi.png")
    save_png(ndre_rgb, output_dir / "ndre.png")
    save_png(ndwi_rgb, output_dir / "ndwi.png")

    return {
        "satellite_image": "satellite.png",
        "ndvi_image": "ndvi.png",
        "ndre_image": "ndre.png",
        "ndwi_image": "ndwi.png",
    }
