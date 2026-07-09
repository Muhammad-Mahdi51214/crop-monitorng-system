"""
Analyze a field polygon using Sentinel-2 L2A with SCL masking.
Reads GeoJSON + options from stdin; prints JSON result to stdout.

Scene selection: try newest scenes first; if cloudy or invalid, walk back
through older captures until one passes quality checks.
"""
from __future__ import annotations

import json
import re
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from geospatial_env import configure_geospatial_env

configure_geospatial_env()

from cdse_config import configure_cdse_s3
from local_processor import process_scene
from stac_client import (
    format_scene_date,
    item_cloud_cover,
    item_datetime_iso,
    item_platform,
    merge_scene_lists,
    open_catalog,
    search_scenes,
)


def _scene_output_folder(field_id: str, item: Any) -> str:
    dt = item_datetime_iso(item)
    if dt:
        safe = dt.replace(":", "").replace("-", "").split(".")[0]
        return f"{field_id}/{safe}Z"
    return f"{field_id}/{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"


def _build_imagery_caution(
    *,
    is_latest: bool,
    used_datetime: str,
    latest_datetime: str,
    attempt_index: int,
    scenes_tried: int,
) -> str | None:
    if is_latest:
        return None
    used_date = format_scene_date(used_datetime)
    latest_date = format_scene_date(latest_datetime)
    if attempt_index == 1:
        return (
            f"The most recent satellite pass ({latest_date}) was too cloudy for this field. "
            f"Showing the previous clear capture from {used_date} instead."
        )
    return (
        f"The latest satellite passes (through {latest_date}) were too cloudy or incomplete. "
        f"Showing the best available clear capture from {used_date} "
        f"(checked {scenes_tried} recent scenes)."
    )


def _collect_candidates(
    es_client: Any,
    boundary: dict[str, Any],
    max_cloud: float,
) -> list[Any]:
    """Gather scenes from multiple search passes (newest first, deduped)."""
    return merge_scene_lists(
        search_scenes(
            es_client,
            boundary,
            days_back=120,
            max_cloud_cover=max_cloud,
            max_items=25,
        ),
        search_scenes(
            es_client,
            boundary,
            days_back=180,
            max_cloud_cover=min(max_cloud + 25, 60),
            max_items=35,
        ),
        search_scenes(
            es_client,
            boundary,
            days_back=365,
            max_cloud_cover=80,
            max_items=50,
        ),
    )


def _try_process_scenes(
    process_items: list[Any],
    meta_items: list[Any],
    *,
    boundary: dict[str, Any],
    min_valid: float,
    allow_water: bool,
    history_ndvi: list[float],
    history_ndre: list[float],
    history_ndwi: list[float],
    output_root: str | None,
    field_id: str,
    data_source_label: str,
) -> tuple[dict[str, Any] | None, list[str], float]:
    errors: list[str] = []
    best_valid_percent = 0.0
    latest_datetime = item_datetime_iso(process_items[0]) if process_items else ""

    for i, item in enumerate(process_items):
        meta = meta_items[i] if i < len(meta_items) else item
        rel_folder = _scene_output_folder(field_id, item)
        output_dir = Path(output_root) / rel_folder if output_root else None

        try:
            scene_out = process_scene(
                item,
                boundary,
                min_valid_pixel_percent=min_valid,
                allow_water=allow_water,
                history_ndvi=history_ndvi,
                history_ndre=history_ndre,
                history_ndwi=history_ndwi,
                output_dir=output_dir,
                data_source=data_source_label,
            )
            used_datetime = item_datetime_iso(meta)
            is_latest = i == 0

            scene_out["scene_id"] = meta.id
            scene_out["scene_datetime"] = used_datetime
            scene_out["scene_date"] = used_datetime
            scene_out["platform"] = item_platform(meta)
            scene_out["cloud_cover_percent"] = round(item_cloud_cover(meta), 1)
            scene_out["scene_attempt_index"] = i
            scene_out["scenes_tried"] = i + 1
            scene_out["is_latest_scene"] = is_latest
            scene_out["latest_scene_datetime"] = latest_datetime
            scene_out["imagery_caution"] = _build_imagery_caution(
                is_latest=is_latest,
                used_datetime=used_datetime,
                latest_datetime=latest_datetime,
                attempt_index=i,
                scenes_tried=i + 1,
            )

            if output_root:
                scene_out["satellite_image"] = f"{rel_folder}/satellite.png"
                scene_out["ndvi_image"] = f"{rel_folder}/ndvi.png"
                scene_out["ndre_image"] = f"{rel_folder}/ndre.png"
                scene_out["ndwi_image"] = f"{rel_folder}/ndwi.png"

            scene_out["scenes_used"] = len(process_items)
            scene_out["ok"] = True
            return scene_out, errors, best_valid_percent
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{item.id}: {exc}")
            match = re.search(r"Only ([\d.]+)% valid pixels", str(exc))
            if match:
                best_valid_percent = max(best_valid_percent, float(match.group(1)))

    return None, errors, best_valid_percent


def analyze_field(payload: dict[str, Any]) -> dict[str, Any]:
    configure_cdse_s3()
    boundary = payload["boundary"]
    if boundary.get("type") == "Feature":
        boundary = boundary["geometry"]

    cdse_catalog = payload.get("cdse_catalog_url")
    earthsearch_url = payload.get(
        "stac_api_url", "https://earth-search.aws.element84.com/v1"
    )
    earthsearch_fallback = str(payload.get("earthsearch_fallback", "true")).lower() == "true"
    max_cloud = float(payload.get("max_cloud_cover_percent", 20))
    min_valid = float(payload.get("min_valid_pixel_percent", 60))
    crop_type = str(payload.get("crop_type", "")).lower()
    allow_water = crop_type in ("rice",)

    history_ndvi = [float(v) for v in payload.get("history_ndvi", []) if v is not None]
    history_ndre = [float(v) for v in payload.get("history_ndre", []) if v is not None]
    history_ndwi = [float(v) for v in payload.get("history_ndwi", []) if v is not None]

    field_id = payload.get("field_id", "unknown")
    output_root = payload.get("output_dir")

    meta_items: list[Any] = []
    try:
        cdse_client, _ = open_catalog(cdse_catalog, earthsearch_url, False)
        meta_items = search_scenes(
            cdse_client, boundary, max_cloud_cover=max_cloud, max_items=25
        )
    except Exception:
        meta_items = []

    es_client, _ = open_catalog(None, earthsearch_url, True)
    process_items = _collect_candidates(es_client, boundary, max_cloud)

    if not process_items:
        return {
            "ok": False,
            "status": "no_clear_imagery",
            "analysis_status": "no_clear_imagery",
            "message": (
                "No satellite scenes found for this field in the last year. "
                "We'll keep checking when new passes are available."
            ),
        }

    data_source_label = (
        "Copernicus CDSE + Earth Search"
        if meta_items
        else "Earth Search"
    )

    # Align metadata list length with process list where possible
    if not meta_items:
        meta_items = list(process_items)
    else:
        meta_by_id = {item.id: item for item in meta_items}
        meta_items = [meta_by_id.get(item.id, item) for item in process_items]

    result, errors, best_valid_percent = _try_process_scenes(
        process_items,
        meta_items,
        boundary=boundary,
        min_valid=min_valid,
        allow_water=allow_water,
        history_ndvi=history_ndvi,
        history_ndre=history_ndre,
        history_ndwi=history_ndwi,
        output_root=output_root,
        field_id=field_id,
        data_source_label=data_source_label,
    )

    if result:
        return result

    if best_valid_percent > 0:
        message = (
            f"Checked {len(process_items)} recent satellite scenes — the clearest had "
            f"{best_valid_percent:g}% usable pixels inside your field "
            f"(need {min_valid:g}%). Try again after the next clear pass."
        )
    else:
        message = (
            f"Checked {len(process_items)} recent satellite scenes — none had enough "
            "clear pixels over your field. Try again after the next clear pass."
        )

    return {
        "ok": False,
        "status": "no_clear_imagery",
        "analysis_status": "no_clear_imagery",
        "message": message,
        "errors": errors[:5],
        "scenes_tried": len(process_items),
        "best_valid_pixel_percent": best_valid_percent,
    }


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        result = analyze_field(payload)
        json.dump(result, sys.stdout)
        if not result.get("ok"):
            sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        json.dump(
            {
                "ok": False,
                "status": "error",
                "error": str(exc),
                "trace": traceback.format_exc(),
            },
            sys.stdout,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
