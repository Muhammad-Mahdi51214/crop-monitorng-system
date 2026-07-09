type Props = {
  greennessHealthyPercent: number;
  waterStressPercent: number;
  chlorophyllLowPercent: number;
};

export default function HealthHeatmap({
  greennessHealthyPercent,
  waterStressPercent,
  chlorophyllLowPercent,
}: Props) {
  const cellsPerRow = 10;
  const makeRow = (percent: number, colorClass: string) => {
    const filled = Math.max(0, Math.min(cellsPerRow, Math.round((percent / 100) * cellsPerRow)));
    return Array.from({ length: cellsPerRow }, (_, i) =>
      i < filled ? colorClass : "bg-[#EEF2EF]",
    );
  };

  const rows = [
    ...makeRow(greennessHealthyPercent, "bg-lime-400"),
    ...makeRow(waterStressPercent, "bg-red-500"),
    ...makeRow(chlorophyllLowPercent, "bg-amber-400"),
  ];

  return (
    <div className="grid grid-cols-10 gap-1">
      {rows.map((color, i) => (
        <span
          key={i}
          className={`aspect-square rounded-sm ${color} opacity-90`}
        />
      ))}
    </div>
  );
}
