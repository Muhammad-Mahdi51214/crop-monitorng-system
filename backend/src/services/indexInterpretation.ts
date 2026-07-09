import { getCropPlaybook } from "./cropKnowledge.js";

export type IndexZoneBreakdown = {
  mean?: number;
  lowPercent: number;
  moderatePercent: number;
  goodPercent: number;
  lowAreaHa: number;
  moderateAreaHa: number;
  goodAreaHa: number;
  lowLabel: string;
  moderateLabel: string;
  goodLabel: string;
};

export type SpatialStats = {
  fieldAreaHa: number;
  analyzedAreaHa: number;
  greenness: IndexZoneBreakdown;
  chlorophyll: IndexZoneBreakdown;
  waterStress: IndexZoneBreakdown;
  surfaceWater?: IndexZoneBreakdown;
  primaryConcern: string;
};

const INDEX_GUIDE = {
  greenness:
    "Greenness map shows how lush the crop is. Low areas may mean bare soil, pest damage, or nitrogen stress.",
  chlorophyll:
    "Chlorophyll map shows leaf vigor. Low areas can mean nutrient shortage or plants under stress.",
  waterStress:
    "Water-stress map (NDMI) shows crop moisture. Low values mean canopy moisture is low and irrigation may be needed.",
};

export function buildFarmerSpatialSummary(
  stats: SpatialStats,
  cropType: string,
): string {
  const crop = cropType || "crop";
  const lines = [
    `Field size about ${stats.fieldAreaHa} ha (${stats.analyzedAreaHa} ha with clear satellite pixels).`,
    `Greenness: ${stats.greenness.goodPercent}% healthy (${stats.greenness.goodAreaHa} ha), ${stats.greenness.lowPercent}% thin/stressed (${stats.greenness.lowAreaHa} ha).`,
    `Chlorophyll: ${stats.chlorophyll.goodPercent}% strong leaves (${stats.chlorophyll.goodAreaHa} ha), ${stats.chlorophyll.lowPercent}% low vigor (${stats.chlorophyll.lowAreaHa} ha).`,
    `NDMI moisture: ${stats.waterStress.goodPercent}% well hydrated (${stats.waterStress.goodAreaHa} ha), ${stats.waterStress.lowPercent}% possible water stress (${stats.waterStress.lowAreaHa} ha).`,
    `Main concern for this ${crop} field: ${stats.primaryConcern === "none" ? "no major hotspot" : stats.primaryConcern}.`,
  ];
  return lines.join(" ");
}

export function buildLlmFieldContext(
  stats: SpatialStats | null,
  cropType: string,
  indices?: { ndvi: number | null; ndre: number | null; ndwi: number | null },
) {
  if (!stats) {
    return {
      indexGuide: INDEX_GUIDE,
      summary: "No spatial breakdown yet — run a satellite refresh first.",
    };
  }

  return {
    indexGuide: INDEX_GUIDE,
    cropType,
    fieldAreaHa: stats.fieldAreaHa,
    analyzedAreaHa: stats.analyzedAreaHa,
    fieldMeans: indices,
    greennessBreakdown: {
      meaning: INDEX_GUIDE.greenness,
      healthyPercent: stats.greenness.goodPercent,
      healthyAreaHa: stats.greenness.goodAreaHa,
      stressedPercent: stats.greenness.lowPercent,
      stressedAreaHa: stats.greenness.lowAreaHa,
      averagePercent: stats.greenness.moderatePercent,
    },
    chlorophyllBreakdown: {
      meaning: INDEX_GUIDE.chlorophyll,
      healthyPercent: stats.chlorophyll.goodPercent,
      healthyAreaHa: stats.chlorophyll.goodAreaHa,
      stressedPercent: stats.chlorophyll.lowPercent,
      stressedAreaHa: stats.chlorophyll.lowAreaHa,
    },
    waterBreakdown: {
      meaning: INDEX_GUIDE.waterStress,
      adequatePercent: stats.waterStress.goodPercent,
      adequateAreaHa: stats.waterStress.goodAreaHa,
      stressedPercent: stats.waterStress.lowPercent,
      stressedAreaHa: stats.waterStress.lowAreaHa,
    },
    primaryConcern: stats.primaryConcern,
    plainSummary: buildFarmerSpatialSummary(stats, cropType),
    adviceFocus: adviceFocusForCrop(stats, cropType),
    cropPlaybook: getCropPlaybook(cropType),
  };
}

function adviceFocusForCrop(stats: SpatialStats, cropType: string): string[] {
  const crop = cropType.toLowerCase();
  const tips: string[] = [];

  if (stats.waterStress.lowPercent >= 15) {
    if (crop === "rice") {
      tips.push(
        "Check paddy water level and bund leaks; maintain standing water where the crop stage needs it.",
      );
    } else if (crop === "maize") {
      tips.push(
        "Maize is sensitive to dry soil before tasseling — irrigate the largest dry zones first.",
      );
    } else if (crop === "cotton") {
      tips.push(
        "Cotton at flowering/boll fill suffers from dry patches — restore moisture in the stressed hectares.",
      );
    } else if (crop === "wheat") {
      tips.push(
        "Wheat tillering and heading need even moisture — check irrigation or rain catch-up in dry zones.",
      );
    } else {
      tips.push(
        "Check irrigation schedule, clogged drippers, or dry patches — water-stressed area is significant.",
      );
    }
  }

  if (stats.greenness.lowPercent >= 15) {
    if (crop === "wheat") {
      tips.push(
        "Walk low-greenness strips for nitrogen stress, rust, or uneven emergence; treat the largest patch first.",
      );
    } else if (crop === "maize") {
      tips.push(
        "Scout pale/thin maize zones for nitrogen shortage, planter skips, or compaction.",
      );
    } else if (crop === "cotton") {
      tips.push(
        "Inspect low-greenness cotton areas for pests, weeds, or delayed squaring.",
      );
    } else {
      tips.push(
        "Walk the low-greenness zones for pests, weeds, or uneven fertilizer; spot-treat those areas first.",
      );
    }
  }

  if (stats.chlorophyll.lowPercent >= 15) {
    if (crop === "rice") {
      tips.push(
        "Pale rice canopy may need nitrogen once water is even — sample soil in the weakest hectares.",
      );
    } else if (crop === "maize") {
      tips.push(
        "Low leaf vigor in maize often tracks nitrogen — consider tissue or soil test in weak zones.",
      );
    } else {
      tips.push(
        "Consider soil or leaf nutrient check in low-vigor zones; chlorophyll is weaker than the field average.",
      );
    }
  }

  if (tips.length === 0) {
    const playbook = getCropPlaybook(crop);
    tips.push(
      `${playbook.label} field looks broadly normal — ${playbook.actions[0] ?? "keep regular scouting."}`,
    );
  }

  return tips;
}
