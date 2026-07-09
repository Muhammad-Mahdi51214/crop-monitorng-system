"""Local rasterio processing with SCL masking."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.mask import mask as rio_mask
from rasterio.transform import array_bounds
from rasterio.warp import Resampling, reproject
from rasterio.warp import transform_bounds, transform_geom
from shapely.geometry import mapping, shape

from cloud_masking import get_valid_pixel_mask, valid_pixel_percent
from raster_processing import (
    apply_analysis_mask,
    compute_ndmi,
    compute_ndre,
    compute_ndvi,
    compute_ndwi,
    export_imagery,
)
from stac_client import band_hrefs, item_cloud_cover, item_datetime_iso, item_platform
from zonal_stats import compute_spatial_stats, compute_zscore, zonal_mean


def _read_masked(href: str, geom_proj: dict) -> tuple[np.ndarray, object, object]:
    with rasterio.open(href) as src:
        data, transform = rio_mask(src, [geom_proj], crop=True, filled=False)
        band = np.asarray(data[0], dtype="float32")
        if np.ma.isMaskedArray(data[0]):
            band = np.where(data[0].mask, np.nan, band)
        return band, transform, src.crs


def _resample_to_ref(
    band: np.ndarray,
    src_transform: object,
    src_crs: object,
    ref_shape: tuple[int, int],
    ref_transform: object,
    ref_crs: object,
    *,
    resampling: Resampling = Resampling.bilinear,
) -> np.ndarray:
    if band.shape == ref_shape:
        return band
    dst = np.full(ref_shape, np.nan, dtype="float32")
    reproject(
        source=band,
        destination=dst,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=ref_transform,
        dst_crs=ref_crs,
        resampling=resampling,
    )
    return dst


def _read_bands(item: Any, boundary: dict[str, Any], allow_water: bool) -> dict[str, Any]:
    geom = shape(boundary)
    hrefs = band_hrefs(item)

    if not all(hrefs[k] for k in ("red", "green", "blue", "rededge", "nir", "swir1", "scl")):
        missing = [k for k, v in hrefs.items() if not v]
        raise ValueError(f"Scene {item.id} missing bands: {', '.join(missing)}")

    with rasterio.open(hrefs["red"]) as red_src:
        geom_proj = transform_geom(
            "EPSG:4326", red_src.crs.to_string(), mapping(geom)
        )

    red_band, ref_transform, ref_crs = _read_masked(hrefs["red"], geom_proj)
    shape2d = red_band.shape

    def align(href: str, *, nearest: bool = False) -> np.ndarray:
        band, transform, crs = _read_masked(href, geom_proj)
        return _resample_to_ref(
            band,
            transform,
            crs,
            shape2d,
            ref_transform,
            ref_crs,
            resampling=Resampling.nearest if nearest else Resampling.bilinear,
        )

    green_band = align(hrefs["green"])
    blue_band = align(hrefs["blue"])
    rededge_band = align(hrefs["rededge"])
    nir_band = align(hrefs["nir"])
    swir1_band = align(hrefs["swir1"])
    scl_band = align(hrefs["scl"], nearest=True)

    field_mask = ~np.isnan(red_band)
    valid_mask = get_valid_pixel_mask(scl_band, allow_water=allow_water) & field_mask

    bands = {
        "red": red_band,
        "green": green_band,
        "blue": blue_band,
        "rededge": rededge_band,
        "nir": nir_band,
        "swir1": swir1_band,
    }
    ndvi = compute_ndvi(red_band, nir_band)
    ndre = compute_ndre(rededge_band, nir_band)
    ndwi = compute_ndmi(nir_band, swir1_band)
    surface_water = compute_ndwi(green_band, nir_band)

    indices = apply_analysis_mask(
        {"ndvi": ndvi, "ndre": ndre, "ndwi": ndwi, "surface_water": surface_water},
        valid_mask,
    )

    west, south, east, north = transform_bounds(
        ref_crs,
        "EPSG:4326",
        *array_bounds(shape2d[0], shape2d[1], ref_transform),
    )

    return {
        "bands": bands,
        "indices": indices,
        "valid_mask": valid_mask,
        "field_mask": field_mask,
        "transform": ref_transform,
        "crs": ref_crs,
        "image_bounds": [west, south, east, north],
        "valid_pixel_percent": valid_pixel_percent(valid_mask, field_mask),
        "cloud_cover_percent": item_cloud_cover(item),
        "scene_id": item.id,
        "scene_datetime": item_datetime_iso(item),
        "platform": item_platform(item),
    }


def process_scene(
    item: Any,
    boundary: dict[str, Any],
    *,
    min_valid_pixel_percent: float,
    allow_water: bool,
    history_ndvi: list[float],
    history_ndre: list[float],
    history_ndwi: list[float],
    output_dir: Path | None,
    data_source: str,
) -> dict[str, Any]:
    data = _read_bands(item, boundary, allow_water)

    if data["valid_pixel_percent"] < min_valid_pixel_percent:
        raise ValueError(
            f"Only {data['valid_pixel_percent']}% valid pixels "
            f"(need {min_valid_pixel_percent}%)"
        )

    vm = data["valid_mask"]
    ndvi_mean = zonal_mean(data["indices"]["ndvi"], vm)
    ndre_mean = zonal_mean(data["indices"]["ndre"], vm)
    ndwi_mean = zonal_mean(data["indices"]["ndwi"], vm)

    spatial_stats = compute_spatial_stats(
        data["indices"],
        vm,
        data["field_mask"],
        data["transform"],
        data["crs"],
    )
    # attach field means for downstream context
    spatial_stats["greenness"]["mean"] = round(ndvi_mean, 4)
    spatial_stats["chlorophyll"]["mean"] = round(ndre_mean, 4)
    spatial_stats["waterStress"]["mean"] = round(ndwi_mean, 4)

    if not (-1.0 <= ndvi_mean <= 1.0):
        raise ValueError(f"NDVI out of range: {ndvi_mean}")

    result: dict[str, Any] = {
        "ndvi_mean": round(ndvi_mean, 4),
        "ndre_mean": round(ndre_mean, 4),
        "ndwi_mean": round(ndwi_mean, 4),
        "anomaly_zscore": round(
            compute_zscore(ndvi_mean, history_ndvi + [ndvi_mean]), 4
        ),
        "anomaly_zscore_ndre": round(
            compute_zscore(ndre_mean, history_ndre + [ndre_mean]), 4
        ),
        "anomaly_zscore_ndwi": round(
            compute_zscore(ndwi_mean, history_ndwi + [ndwi_mean]), 4
        ),
        "valid_pixel_percent": data["valid_pixel_percent"],
        "cloud_cover_percent": round(data["cloud_cover_percent"], 1),
        "scene_id": data["scene_id"],
        "scene_datetime": data["scene_datetime"],
        "scene_date": data["scene_datetime"],
        "platform": data["platform"],
        "product_level": "L2A",
        "data_source": data_source,
        "sensor": "MSI",
        "analysis_status": "ok",
        "image_bounds": data["image_bounds"],
        "spatial_stats": spatial_stats,
    }

    if output_dir:
        imagery = export_imagery(
            data["bands"], data["indices"], vm, output_dir
        )
        result.update(imagery)

    return result
