export type FarmerStatus = {
  color: "green" | "yellow" | "red";
  label: string;
  message: string;
};

/**
 * Combines greenness anomaly (NDVI/NDRE) and water stress (NDWI)
 * into one farmer-facing status.
 */
export function toFarmerStatus(
  ndviZscore: number,
  ndreZscore: number,
  ndmiZscore: number,
): FarmerStatus {
  const stressSignals: string[] = [];

  if (ndviZscore < -0.5 || ndreZscore < -0.5) {
    stressSignals.push("greenness");
  }
  if (ndmiZscore < -0.5) {
    stressSignals.push("water");
  }

  if (stressSignals.length === 0) {
    return {
      color: "green",
      label: "Looking healthy",
      message: "Your field looks normal for this time of year.",
    };
  }

  if (stressSignals.includes("water") && !stressSignals.includes("greenness")) {
    return {
      color: "yellow",
      label: "Possible water stress",
      message:
        "Your field's greenness looks normal, but our water-stress signal is elevated — worth checking irrigation.",
    };
  }

  if (stressSignals.length === 1) {
    return {
      color: "yellow",
      label: "Worth a look",
      message:
        "Your field is a bit less green than usual — a quick field visit is a good idea.",
    };
  }

  return {
    color: "red",
    label: "Needs attention",
    message:
      "Your field shows both reduced greenness and possible water stress — we'd recommend checking it soon.",
  };
}
