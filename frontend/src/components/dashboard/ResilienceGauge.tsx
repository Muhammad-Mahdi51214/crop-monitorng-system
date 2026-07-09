type Props = {
  score: number;
  label: string;
  trend?: string;
};

export default function ResilienceGauge({ score, label, trend }: Props) {
  const clamped = Math.max(0, Math.min(10, score));
  const rotation = -90 + (clamped / 10) * 180;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-48 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-24 w-48 rounded-t-full border-[10px] border-emerald-100 bg-emerald-50" />
        <div
          className="absolute bottom-0 left-1/2 h-[72px] w-[3px] origin-bottom rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(22,163,74,0.5)]"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
      </div>
      <p className="mt-1 text-3xl font-bold text-emerald-950">{clamped.toFixed(1)}</p>
      <p className="text-sm font-semibold text-emerald-600">{label}</p>
      {trend && <p className="mt-1 text-xs text-emerald-700/70">{trend}</p>}
    </div>
  );
}
