# Crop Stress Detection — Methodology Correction & Standardization

**Scope:** AgroAI Platform index computation, thresholds, and status labeling
**Basis:** Direct review of `raster_processing.py`, `zonal_stats.py`, `stac_client.py`, `local_processor.py`, `farmerTranslate.ts` (Cursor investigation, no code changes made)
**Satellite source confirmed:** Sentinel-2 (identified via `scl` — Scene Classification Layer, a Sentinel-2–specific product)

---

## 1. Root Cause

Two independent problems compound into the false "97% possible water stress" reading:

| # | Problem | Evidence |
|---|---|---|
| 1 | **Wrong index for the question being asked.** `compute_ndwi()` implements McFeeters' NDWI (`Green−NIR / Green+NIR`), a **surface-water/flooding detector**, not a crop-moisture index. | `raster_processing.py`, lines 33–40 |
| 2 | **Thresholds are untested placeholders, not literature values.** Code comment explicitly says `# Farmer-facing zones (tune per crop/region in calibration)` — these were never calibrated. | `zonal_stats.py`, lines 11–17 |

Because McFeeters NDWI is *structurally* negative for any healthy, non-flooded vegetated field (often −0.3 to −0.8), a threshold of `NDWI_STRESS = -0.15` will mark **almost all normal crop pixels** as stressed. This isn't a borderline calibration issue — it's a mismatch between what the formula measures and what the label claims.

---

## 2. Available Inputs

Confirmed bands in the pipeline: **Red, Green, Blue, NIR, Red Edge, SCL**.
**SWIR is not currently ingested**, even though Sentinel-2 provides it natively (Band 11 ~1610nm, Band 12 ~2190nm). This matters because SWIR is required for any scientifically valid crop-water-content index.

---

## 3. Recommended Standardized Methodology

### 3.1 NDVI (Greenness) — keep formula, replace thresholds

Formula is already standard: `(NIR − Red) / (NIR + Red)` (Rouse et al., 1974).

| Zone | Threshold | Basis |
|---|---|---|
| Healthy | ≥ 0.50 | Rouse et al. 1974; widely adopted in commercial ag platforms (Sentinel Hub, EOS) |
| Watch | 0.20 – 0.50 | Transitional canopy closure / early growth stage |
| Stressed | < 0.20 | Bare soil, severe stress, or very early emergence |

**Caveat:** NDVI is stage-dependent — early-season maize will legitimately sit in "Watch" territory with no real problem. Thresholds should ideally shift with a crop calendar, not stay static across the season (see §3.4).

### 3.2 NDRE (Chlorophyll) — keep formula, replace thresholds

Formula is already standard: `(NIR − RedEdge) / (NIR + RedEdge)` (Gitelson & Merzlyak, 1994; Barnes et al., 2000).

| Zone | Threshold | Basis |
|---|---|---|
| Healthy | ≥ 0.35 | Barnes et al. 2000 — commercial nitrogen/vigor management standard |
| Watch | 0.20 – 0.35 | Moderate chlorophyll/nitrogen decline |
| Stressed | < 0.20 | Low leaf vigor / nitrogen deficiency |

### 3.3 Water — this is where the real fix belongs

**Primary recommendation: implement true NDMI using SWIR (Gao, 1996).**

```
NDMI = (NIR − SWIR1) / (NIR + SWIR1)     # Sentinel-2: B8 (NIR), B11 (SWIR1)
```

This is the actual peer-reviewed standard for canopy water content in crops (Gao 1996; Jackson et al. 2004, validated specifically on agricultural canopies). Since you're already on Sentinel-2, this only requires pulling one more band per scene — no new data source.

| Zone | Threshold | Basis |
|---|---|---|
| Well-hydrated | > 0.40 | Gao 1996 |
| Moderate | 0.00 – 0.40 | Transitional |
| Water stress | < 0.00 | Gao 1996; Jackson et al. 2004 |

**Do not delete the existing McFeeters NDWI.** It's a legitimate, useful index — just relabel it as what it actually measures.

| Current label | Corrected label | Meaning |
|---|---|---|
| "Water stress" | **"Surface water / flooding signal"** | Detects standing water, waterlogging, flooded rows — useful for drainage/irrigation-overflow monitoring, not drought |

**If SWIR cannot be added immediately (interim fallback):**
Do not use McFeeters NDWI as a stress proxy at any threshold. Instead, use **NDVI + NDRE joint decline over time** (both trending down across ≥2 consecutive passes) as the best available proxy for moisture-related stress from optical-only data. Flag it explicitly as lower-confidence, since true canopy water content cannot be measured without SWIR or thermal data.

### 3.4 The deeper fix: absolute thresholds vs. anomaly detection

Your NDVI/NDRE logic in `farmerTranslate.ts` already uses **z-scores** (relative anomaly vs. the field's own baseline) — this is the correct, standard approach in precision agriculture, because raw index values vary enormously by crop type, growth stage, soil background, and sensor calibration. A universal cutoff (e.g., "NDVI < 0.25 = stressed") is weaker practice than "this pixel is 0.5 standard deviations below this field's own 30-day average."

**The water-stress check does not follow this pattern** — it uses a flat, non-relative cutoff (`ndwiValue < -0.1`). This is inconsistent with the rest of the system and is a second, independent reason it over-triggers.

**Recommendation:** whichever water-related index you finalize (NDMI or interim NDVI/NDRE decline), score it the same way as NDVI/NDRE — as a z-score anomaly against the field's own historical baseline — not a fixed universal number.

---

## 4. Aggregation Logic (keep, once inputs are fixed)

The pixel→field percentage method itself is sound and doesn't need to change:

```
lowPercent = 100 × (pixels below threshold) / (total valid pixels)
```

This logic in `zonal_stats.py` (lines 66–94) is fine — it was only ever as accurate as the threshold and formula feeding it, both of which are addressed above.

---

## 5. Combined Status Label Logic — recommended update

Current (`farmerTranslate.ts`):
```
if (ndviZscore < -0.5 || ndreZscore < -0.5) stressSignals.push("greenness")
if (ndwiValue < -0.1) stressSignals.push("water")
```

Recommended:
```
if (ndviZscore < -0.5 || ndreZscore < -0.5) stressSignals.push("greenness")
if (ndmiZscore < -0.5) stressSignals.push("water")       // true NDMI, z-scored
// interim fallback if SWIR not yet available:
// if (ndviZscore < -0.5 && ndreZscore < -0.5) stressSignals.push("water_lowConfidence")
```

Keep the McFeeters-derived "flooding" signal as a **separate, additive flag** (e.g., "Waterlogging risk") rather than folding it into the drought-stress signal — the two are physically opposite conditions and currently share one variable name.

---

## 6. Implementation Checklist

- [ ] Pull SWIR1 (B11) from Sentinel-2 STAC assets in `stac_client.py`
- [ ] Add `compute_ndmi(nir, swir1)` in `raster_processing.py`
- [ ] Replace `NDWI_STRESS` / `NDWI_ADEQUATE` thresholds with NDMI-based thresholds (§3.3)
- [ ] Rename existing McFeeters output field from `water` (stress) to `surfaceWater` (flooding) throughout `zonal_stats.py`
- [ ] Update `farmerTranslate.ts` to z-score the water signal instead of using a flat cutoff
- [ ] Replace NDVI/NDRE threshold constants with §3.1/§3.2 values, and note crop-stage sensitivity in comments
- [ ] Add citations as code comments so future devs don't repeat the placeholder-threshold issue

---

## 7. References

- Rouse, J.W. et al. (1974). *Monitoring vegetation systems in the Great Plains with ERTS.* NASA SP-351.
- Gitelson, A. & Merzlyak, M. (1994). *Spectral reflectance changes associated with autumn senescence.* J. Plant Physiol.
- Barnes, E.M. et al. (2000). *Coincident detection of crop water stress, nitrogen status, and canopy density.* Proc. 5th Intl. Conf. on Precision Agriculture.
- McFeeters, S.K. (1996). *The use of Normalized Difference Water Index (NDWI) in the delineation of open water features.* Intl. J. Remote Sensing.
- Gao, B. (1996). *NDWI — A normalized difference water index for remote sensing of vegetation liquid water from space.* Remote Sensing of Environment.
- Jackson, T.J. et al. (2004). *Vegetation water content mapping using Landsat data derived normalized difference water index for corn and soybeans.* Remote Sensing of Environment.

---

**Bottom line:** the platform isn't wrong to report water-related signals — it's reporting the *wrong one* under the *wrong label* with *untested thresholds*. Fixing the label alone (Option A, discussed earlier) removes the false alarm today; adding NDMI (this document's recommendation) gives you the real crop-drought signal the dashboard was always trying to show.
