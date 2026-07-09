"""Scene Classification Layer (SCL) masking for Sentinel-2 L2A."""
from __future__ import annotations

import numpy as np

# SCL classes safe for vegetation index calculation (Section 2.2)
VALID_SCL_CLASSES = {4, 5, 7}  # vegetation, bare soil, unclassified
WATER_SCL_CLASS = 6


def get_valid_pixel_mask(
    scl_band: np.ndarray,
    *,
    allow_water: bool = False,
) -> np.ndarray:
    """
    Returns boolean mask of pixels safe for vegetation index calculation.
  Excludes nodata, clouds, shadows, dark areas, snow, etc.
    """
    classes = set(VALID_SCL_CLASSES)
    if allow_water:
        classes.add(WATER_SCL_CLASS)
    scl = np.round(np.nan_to_num(scl_band, nan=-1)).astype(np.int16)
    return np.isin(scl, list(classes))


def valid_pixel_percent(valid_mask: np.ndarray, field_mask: np.ndarray) -> float:
    """Percent of field pixels that pass SCL filtering."""
    total = int(np.sum(field_mask))
    if total == 0:
        return 0.0
    valid = int(np.sum(valid_mask & field_mask))
    return round(100.0 * valid / total, 1)
