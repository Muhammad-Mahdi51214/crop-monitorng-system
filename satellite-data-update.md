# Crop Health Copilot — Satellite Data Source & Monitoring Accuracy Update

> **Purpose of this document:** This is an update/addendum to `crop-health-copilot-spec.md`. It replaces the imagery-source decision and expands the analysis layer with a research-backed set of vegetation indices, required outputs, and validation graphs. Hand this file to Cursor alongside the original spec and say: *"Read this update alongside crop-health-copilot-spec.md. Apply the changes in Section 1 (data source) and Section 3 (analysis outputs) to the existing codebase — update `stac_client.py`, `raster_processing.py`, `zonal_stats.py`, and the API responses accordingly. Do not rebuild what's not mentioned here."*

---

## 1. Chosen Satellite Imagery Source (replaces plain Earth Search)

### Decision: Copernicus Data Space Ecosystem — Sentinel-2 L2A via Sentinel Hub / STAC API

**Why this one, specifically, over the alternatives:**

| Requirement | How this source satisfies it |
|---|---|
| Free, reliable, no cost at any scale for this project | Official ESA/EU platform, free for all users, no card required |
| Atmospherically corrected | Use the **L2A** product tier specifically (not L1C). L2A is Bottom-of-Atmosphere (BOA) reflectance — atmospheric correction (Sen2Cor algorithm) has already been applied by ESA before it reaches you. **Never use L1C** (Top-of-Atmosphere, uncorrected) for this project. |
| No dark / cloudy / blurry pixels | Every L2A product ships with a **Scene Classification Layer (SCL)** band that flags each pixel as clear, cloud, cloud shadow, cirrus, snow, water, or dark-area/no-data. This is the exact mechanism for excluding bad pixels — see Section 2 below. |
| Latest available imagery for a given area | STAC Catalog API lets you query by bounding box + date range + cloud-cover percentage, sorted by most recent acquisition |
| Avoids downloading full scenes just to get pixels for one field | Sentinel Hub API can return only the clipped, band-mathed result for your exact field polygon — cloud computes it, you just receive the answer |
| Fast enough for a chat-speed MVP | Because processing happens server-side, you avoid downloading and locally processing multi-hundred-MB scenes just to analyze one small field |

**Alternatives considered and why they were not chosen as primary:**
- **Element84 Earth Search (previous choice):** still fine as a fallback/secondary source, and genuinely simpler to start with (fully open, zero signup). Keep the existing `stac_client.py` code path as `EARTHSEARCH_FALLBACK=true` option. Its limitation: no free server-side band math — you must download and process raw bands yourself, which is slower and gives you less control over cloud/dark-pixel filtering unless you handle SCL manually.
- **Google Earth Engine:** excellent free option with server-side processing, but requires a Google Cloud project + non-commercial use approval process, which adds friction for a fast student MVP timeline. Worth mentioning as future-work.
- **Microsoft Planetary Computer:** good alternative catalog, but Sentinel Hub's specific advantage — pre-built cloud/dark-pixel masking via SCL plus direct clipped analysis-ready output — makes Copernicus's own ecosystem the more natural fit here since it's the native home of Sentinel-2 data.

**Account setup (if not already done from the previous spec):**
1. Go to **https://dataspace.copernicus.eu** → Register (free, no card)
2. Go to **https://shapps.dataspace.copernicus.eu/dashboard/** → create an OAuth client (Sentinel Hub dashboard) → this gives you a `CLIENT_ID` and `CLIENT_SECRET`
3. Add both to `.env`:
```
CDSE_CLIENT_ID=your_client_id_here
CDSE_CLIENT_SECRET=your_client_secret_here
CDSE_CATALOG_URL=https://catalogue.dataspace.copernicus.eu/stac
CDSE_PROCESS_URL=https://sh.dataspace.copernicus.eu/api/v1/process
```

---

## 2. Cloud, Shadow, and Dark-Pixel Filtering (this is what guarantees "clean" imagery)

This is the step most beginner GIS projects skip, and it's exactly what makes the difference between "technically pulled an image" and "pulled a usable, analysis-ready image." Implement this as its own function, run **before** any NDVI/index calculation.

### 2.1 Scene-level filtering (choosing which date to use at all)
- Query the STAC Catalog API for the field's bounding box, sorted by most recent date first
- Filter to scenes where `eo:cloud_cover < 20%` (a standard, widely-used threshold in the literature for usable agricultural monitoring imagery)
- If the most recent scene is above this threshold, fall back to the next most recent clear scene — do not use a heavily clouded scene just because it's newest

### 2.2 Pixel-level filtering (cleaning the specific field area within a chosen scene)
Use the **Scene Classification Layer (SCL)** band that ships with every L2A product. Mask out any pixel classified as:

| SCL value | Meaning | Action |
|---|---|---|
| 0 | No data | Exclude |
| 1 | Saturated / defective | Exclude |
| 2 | Dark area pixels (shadow, low reflectance) | Exclude |
| 3 | Cloud shadows | Exclude |
| 6 | Water | Exclude (unless the crop is rice/paddy — flag separately) |
| 8, 9, 10 | Cloud (medium/high probability), cirrus | Exclude |
| 11 | Snow/ice | Exclude |
| **4, 5, 7** | **Vegetation, bare soil, unclassified (usually clear)** | **Keep — these are your valid analysis pixels** |

```python
def get_valid_pixel_mask(scl_band):
    """
    Returns a boolean mask of pixels safe to use for vegetation index
    calculation, based on the Sentinel-2 L2A Scene Classification Layer.
    Any pixel not explicitly marked valid here is excluded — this is
    what prevents dark, cloudy, or shadowed pixels from corrupting
    the field's greenness reading.
    """
    valid_classes = {4, 5, 7}  # vegetation, bare soil, unclassified
    return np.isin(scl_band, list(valid_classes))
```

### 2.3 Minimum valid-pixel threshold
If, after masking, **fewer than 60% of the field's pixels remain valid**, do not compute or report a result for that date — instead, the API should return a `"status": "no_clear_imagery"` response, and the farmer-facing UI should say something like *"No clear satellite picture available yet for this date — we'll check again soon."* This is far better UX than silently reporting a wrong or noisy number.

### 2.4 Optional: temporal compositing for extra reliability
For an even cleaner "latest image," build a **best-available composite**: take the most recent 2-3 valid (low-cloud) scenes within the last 10-15 days, and use the median (not mean — median is more robust to leftover noisy pixels) per-pixel value across them rather than relying on a single date. This is a common, well-supported technique for reducing residual noise beyond what cloud masking alone catches.

---

## 3. Vegetation Indices & Required Outputs (research-backed, replaces NDVI-only design)

### 3.1 Why NDVI alone is not sufficient
The literature consistently shows a single vegetation index is not the most accurate or reliable option for crop monitoring on its own — Sentinel-2's red-edge bands in particular (~705nm, 740nm, 783nm) are highly sensitive to chlorophyll and nitrogen content and less prone to saturation in dense canopies compared to NDVI, making index combinations meaningfully more accurate than NDVI in isolation.

### 3.2 Indices to compute (all from Sentinel-2 L2A bands)

| Index | Formula (Sentinel-2 bands) | What it tells you | Priority |
|---|---|---|---|
| **NDVI** | (B8−B4)/(B8+B4) | General greenness/vigor | Core (MVP) |
| **NDRE** | (B8−B5)/(B8+B5) | Chlorophyll/nitrogen stress, more accurate at early and late growth stages, avoids NDVI's saturation | Core (MVP) |
| **NDWI** | (B3−B8)/(B3+B8) | Water content / drought stress signal | Core (MVP) |
| **GNDVI** | (B8−B3)/(B8+B3) | Chlorophyll, water/nitrogen uptake, saturates later than NDVI | Phase 2 |
| **EVI2** | 2.5×(B8−B4)/(B8+2.4×B4+1) | Canopy vigor with reduced background/atmosphere noise; found to be a significant yield predictor alongside NDVI | Phase 2 |
| **MSAVI** | (2×B8+1−√((2×B8+1)²−8×(B8−B4)))/2 | Corrects for soil background, best for early/sparse growth stages | Phase 2 |

**MVP recommendation:** compute NDVI + NDRE + NDWI together (all derivable from the same 3 bands you're already fetching). Combine them into a single "field health" reading, not just NDVI in isolation — e.g., "greenness normal, but water index flags drought stress" is a meaningfully more useful farmer message than greenness alone.

### 3.3 Required Outputs / Graphs (what the platform must be able to produce)

1. **Multi-index time-series chart (phenology curve)** — line chart of NDVI + NDRE across the season per field; a single snapshot value is not sufficient, canopy-cover/index time series is what actually proves a trend rather than noise.
2. **Spatial greenness map** — colored raster (red→yellow→green) of NDVI/NDRE *within* the field boundary, not just one averaged number — reveals within-field variability a single number hides.
3. **Anomaly map** — spatial z-score of current vs. historical baseline NDVI/NDRE for the same field and time-of-year, showing *where* in the field a problem is, not just that one exists.
4. **Water-stress overlay** — separate NDWI-based map/flag, since NDVI/NDRE alone won't reliably catch drought stress.
5. **Validation scatter plot (predicted vs. observed)** — if any ground-truth or reference data exists (even a handful of known-healthy vs. known-stressed reference fields), report **R², RMSE, MAE** — these are the standard accuracy metrics used throughout the literature (e.g., studies report R² ranging roughly 0.4–0.9 and RMSE/MAE in tons/hectare depending on crop and index combination).
6. **Confusion matrix + Overall Accuracy + Kappa** — for the crop-type classification model specifically (not the anomaly score) — standard practice for reporting classifier accuracy rather than a single "% correct" number.
7. **Data-quality/availability chart** — a simple calendar/bar view of which recent dates had usable (low-cloud, sufficient valid-pixel) imagery vs. which were skipped — this transparency is itself a credibility signal, since cloud cover is explicitly called out in the literature as a major factor in time-series data quality.

### 3.4 Updated farmer-facing translation logic
Extend the `farmer_translate.py` function from the original spec to consider **both** greenness anomaly and water-stress signal, not NDVI alone:

```python
def to_farmer_status(ndvi_zscore: float, ndre_zscore: float, ndwi_value: float) -> dict:
    """
    Combines greenness anomaly (NDVI/NDRE) and water stress (NDWI)
    into one farmer-facing status. Multiple indices are combined
    because relying on NDVI alone is not considered a reliable
    approach for accurate crop stress detection.
    """
    stress_signals = []
    if ndvi_zscore < -0.5 or ndre_zscore < -0.5:
        stress_signals.append("greenness")
    if ndwi_value < -0.1:  # tune threshold per crop/region during calibration
        stress_signals.append("water")

    if not stress_signals:
        return {"color": "green", "label": "Looking healthy",
                "message": "Your field looks normal for this time of year."}
    elif "water" in stress_signals and "greenness" not in stress_signals:
        return {"color": "yellow", "label": "Possible water stress",
                "message": "Your field's greenness looks normal, but our water-stress signal is elevated — worth checking irrigation."}
    elif len(stress_signals) == 1:
        return {"color": "yellow", "label": "Worth a look",
                "message": "Your field is a bit less green than usual — a quick field visit is a good idea."}
    else:
        return {"color": "red", "label": "Needs attention",
                "message": "Your field shows both reduced greenness and possible water stress — we'd recommend checking it soon."}
```

---

## 4. Updated Repository Changes (tell Cursor exactly what to touch)

```
backend/app/services/
├── stac_client.py          # UPDATE: point primary queries at Copernicus Data Space
│                            #         Ecosystem STAC Catalog; keep Earth Search as fallback
├── cloud_masking.py         # NEW: implements SCL-based valid-pixel filtering (Section 2)
├── raster_processing.py    # UPDATE: compute NDVI + NDRE + NDWI (not NDVI only),
│                            #         apply cloud_masking before any index math
├── zonal_stats.py           # UPDATE: return mean/std per index, plus % valid pixels used
├── compositing.py           # NEW (optional/Phase 2): median composite of last 2-3 clear scenes
├── farmer_translate.py     # UPDATE: use the multi-index function in Section 3.4
└── model_inference.py      # unchanged
```

**New environment variables to add to `.env.example`:**
```
CDSE_CLIENT_ID=your_client_id_here
CDSE_CLIENT_SECRET=your_client_secret_here
CDSE_CATALOG_URL=https://catalogue.dataspace.copernicus.eu/stac
CDSE_PROCESS_URL=https://sh.dataspace.copernicus.eu/api/v1/process
MAX_CLOUD_COVER_PERCENT=20
MIN_VALID_PIXEL_PERCENT=60
```

**API response changes** — `GET /fields/{id}/analysis/latest` should now return:
```json
{
  "field_id": "uuid",
  "date": "2026-06-28",
  "ndvi_mean": 0.58,
  "ndre_mean": 0.41,
  "ndwi_mean": -0.05,
  "valid_pixel_percent": 87.3,
  "cloud_cover_percent": 8.2,
  "anomaly_zscore_ndvi": -0.9,
  "anomaly_zscore_ndre": -0.6,
  "status": "Worth a look",
  "predicted_crop_type": "wheat",
  "model_confidence": 0.87
}
```

---

## 5. Instructions for Cursor

> Read this file (`satellite-data-update.md`) alongside `crop-health-copilot-spec.md`. Apply these specific changes to the existing project:
> 1. Switch the primary imagery source from plain Earth Search to **Copernicus Data Space Ecosystem (Sentinel-2 L2A via Sentinel Hub/STAC API)**, keeping Earth Search as a fallback option behind an env flag.
> 2. Implement `cloud_masking.py` using the Scene Classification Layer logic in Section 2 — this must run before any vegetation index is calculated, and scenes/pixels failing the thresholds must be excluded, not silently included.
> 3. Expand `raster_processing.py` to compute NDVI, NDRE, and NDWI together (formulas in Section 3.2), not NDVI alone.
> 4. Update `farmer_translate.py` to the multi-index version in Section 3.4.
> 5. Update the `/fields/{id}/analysis/latest` API response shape to match Section 4.
> 6. Add the new environment variables to `.env.example` and the setup README.
> 7. Do not change anything about the frontend, database schema, chat/LLM layer, or hosting setup from the original spec — those stay as previously defined.

---

## 6. References

1. **Sentinel-2 for Crop Yield Estimation: A Systematic Review** — arXiv, 2026. https://arxiv.org/html/2603.23779v1
2. **Mapping crop yield spatial variability using Sentinel-2 vegetation indices in Ethiopia** — *Arabian Journal of Geosciences*, Springer Nature. https://link.springer.com/article/10.1007/s12517-023-11754-x
3. **Integration of Sentinel-derived NDVI to reduce uncertainties in operational field monitoring of maize** — *ScienceDirect*. https://www.sciencedirect.com/science/article/abs/pii/S0378377421002638
4. **Comparing vegetation indices from Sentinel-2 and Landsat 8 under different vegetation gradients based on a controlled grazing experiment** — *ScienceDirect*. https://www.sciencedirect.com/science/article/pii/S1470160X21010281
5. **Evaluation and cross-comparison of vegetation indices for crop monitoring from Sentinel-2 and WorldView-2 images** — ResearchGate. https://www.researchgate.net/publication/320481545
6. **Machine Learning for Dynamic Management Zone in Smart Farming** — arXiv:2408.00789. https://arxiv.org/pdf/2408.00789
7. **Multi-Sensor NDVI Time Series for Crop and Fallow Land Classification in Khabarovsk Krai, Russia** — PMC. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12473680/
8. **Copernicus Data Space Ecosystem — API Documentation** (Sentinel Hub Catalog API, L2A product specification, Scene Classification Layer). https://documentation.dataspace.copernicus.eu/APIs.html
