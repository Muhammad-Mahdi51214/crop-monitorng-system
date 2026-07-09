const CROP_PLAYBOOKS: Record<string, { label: string; overview: string; watchFor: string[]; actions: string[] }> = {
  wheat: {
    label: "Wheat",
    overview:
      "Wheat needs steady moisture at tillering and heading, good nitrogen for leaf growth, and scouting for rust and aphids in humid periods.",
    watchFor: [
      "Patchy thin stands or yellowing strips (nitrogen or water stress)",
      "Rust-colored spots on leaves",
      "Uneven heading across the field",
    ],
    actions: [
      "Irrigate or schedule rain catch-up if moisture signal is low in large zones",
      "Soil or tissue test before top-dress nitrogen in weak-green areas",
      "Walk low-vigor patches for weed competition and root constraints",
    ],
  },
  rice: {
    label: "Rice",
    overview:
      "Rice depends on controlled flooding or wet conditions by growth stage, steady nitrogen, and clean bunds to hold water.",
    watchFor: [
      "Dry patches inside the paddy (broken bunds or clogged inlets)",
      "Pale or thin canopy in parts of the field",
      "Standing water too deep or too shallow for the current stage",
    ],
    actions: [
      "Check bunds, inlets, and water depth — repair leaks first",
      "Adjust water level to crop stage (more shallow near maturity)",
      "Target nitrogen in pale zones after confirming water is even",
    ],
  },
  cotton: {
    label: "Cotton",
    overview:
      "Cotton is sensitive to water stress at flowering and boll fill, needs balanced nutrients, and benefits from pest scouting (whitefly, bollworm).",
    watchFor: [
      "Wilting or thin canopy in flowering zones",
      "Stunted squares or uneven boll set",
      "Large bare-soil or low-greenness patches",
    ],
    actions: [
      "Prioritize irrigation in the largest water-stressed hectares",
      "Scout low-vigor zones for pests and root compaction",
      "Avoid late heavy nitrogen that pushes leaf over boll production",
    ],
  },
  maize: {
    label: "Maize",
    overview:
      "Maize needs reliable moisture at knee-high through tasseling, strong nitrogen for canopy, and scouting for streaking or pest damage in vegetative stages.",
    watchFor: [
      "Striped or pale leaves (possible nitrogen shortage)",
      "Dry zones before tasseling",
      "Uneven plant height across the field",
    ],
    actions: [
      "Irrigate ahead of heat if water-stress zones are spreading",
      "Side-dress or fertigate in pale/chlorophyll-weak areas after soil check",
      "Walk the lowest-greenness hectares for compaction or planter skips",
    ],
  },
  other: {
    label: "Crop",
    overview:
      "Use satellite greenness, leaf vigor, and water signals together with field walks to spot stress early.",
    watchFor: [
      "Large low-greenness or low-chlorophyll zones",
      "Expanding dry signal across the field",
      "Sudden change versus prior weeks",
    ],
    actions: [
      "Walk the largest stressed zone first",
      "Match irrigation and nutrition to what you see on the ground",
      "Re-check after any intervention in 1–2 weeks",
    ],
  },
};

export function getCropPlaybook(cropType: string) {
  const key = cropType.toLowerCase();
  return CROP_PLAYBOOKS[key] ?? CROP_PLAYBOOKS.other;
}
