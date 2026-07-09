"""STAC catalog search — CDSE primary, Earth Search fallback."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from pystac_client import Client


def open_catalog(
    cdse_catalog_url: str | None,
    earthsearch_url: str,
    earthsearch_fallback: bool,
) -> tuple[Client, str]:
    """Return (client, source_label). Tries CDSE first."""
    if cdse_catalog_url:
        try:
            client = Client.open(cdse_catalog_url)
            return client, "Copernicus CDSE"
        except Exception:
            if not earthsearch_fallback:
                raise
    if earthsearch_fallback:
        return Client.open(earthsearch_url), "Earth Search"
    raise ValueError("No STAC catalog available")


def search_scenes(
    client: Client,
    boundary: dict[str, Any],
    *,
    days_back: int = 120,
    max_cloud_cover: float = 20.0,
    max_items: int = 20,
) -> list[Any]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days_back)

    collections = ["sentinel-2-l2a"]
    search = client.search(
        collections=collections,
        intersects=boundary,
        datetime=f"{start.isoformat()}/{end.isoformat()}",
        query={"eo:cloud_cover": {"lt": max_cloud_cover}},
        max_items=max_items,
    )

    items = list(search.items())
    items.sort(
        key=lambda i: i.datetime or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return items


def merge_scene_lists(*lists: list[Any]) -> list[Any]:
    """Merge STAC items newest-first, deduplicated by id."""
    seen: set[str] = set()
    merged: list[Any] = []
    for items in lists:
        for item in items:
            if item.id in seen:
                continue
            seen.add(item.id)
            merged.append(item)
    merged.sort(
        key=lambda i: i.datetime or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return merged


def item_cloud_cover(item: Any) -> float:
    props = item.properties or {}
    return float(props.get("eo:cloud_cover", 100.0))


def item_platform(item: Any) -> str:
    props = item.properties or {}
    platform = props.get("platform") or props.get("constellation") or ""
    pid = item.id.upper()
    if "S2A" in pid or platform == "sentinel-2a":
        return "Sentinel-2A"
    if "S2B" in pid or platform == "sentinel-2b":
        return "Sentinel-2B"
    if "S2C" in pid or platform == "sentinel-2c":
        return "Sentinel-2C"
    return str(platform) or "Sentinel-2"


def item_datetime_iso(item: Any) -> str:
    if item.datetime:
        return item.datetime.isoformat()
    return ""


def format_scene_date(iso_dt: str) -> str:
    if not iso_dt:
        return "an earlier date"
    return iso_dt[:10]


def pick_asset_href(item: Any, *keys: str) -> str | None:
    assets = item.assets
    for key in keys:
        asset = assets.get(key)
        if asset and asset.href:
            return asset.href
    for key in keys:
        key_lower = key.lower()
        for asset_key, asset in assets.items():
            if key_lower in asset_key.lower() and asset.href:
                return asset.href
    return None


def band_hrefs(item: Any) -> dict[str, str | None]:
    """Resolve band URLs for both Earth Search and CDSE naming."""
    return {
        "red": pick_asset_href(item, "B04_20m", "B04_10m", "red", "B04"),
        "green": pick_asset_href(item, "B03_20m", "B03_10m", "green", "B03"),
        "blue": pick_asset_href(item, "B02_20m", "B02_10m", "blue", "B02"),
        "rededge": pick_asset_href(
            item, "B05_20m", "rededge", "rededge1", "B05"
        ),
        "nir": pick_asset_href(item, "B08_10m", "B08_20m", "nir", "nir08", "B08"),
        "swir1": pick_asset_href(item, "B11_20m", "swir16", "swir1", "B11"),
        "scl": pick_asset_href(item, "SCL_20m", "SCL_60m", "scl", "SCL"),
    }
