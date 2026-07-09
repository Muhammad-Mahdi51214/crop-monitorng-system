"use client";

import type { QualityDay } from "@/lib/api";

type Props = {
  days: QualityDay[];
};

export default function DataQualityCalendar({ days }: Props) {
  if (days.length === 0) {
    return (
      <p className="text-sm text-emerald-700">
        No satellite checks recorded in the last 30 days yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-emerald-700">
        Which recent dates had clear enough imagery to analyze your field.
      </p>
      <div className="flex flex-wrap gap-2">
        {days.map((day, i) => {
          const label = new Date(day.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          return (
            <div
              key={`${day.date}-${i}`}
              title={
                day.usable
                  ? `Clear imagery · ${day.validPixelPercent ?? "?"}% valid pixels`
                  : "Skipped — too cloudy or not enough clear pixels"
              }
              className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${
                day.usable
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                  : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
              }`}
            >
              <div>{label}</div>
              <div className="mt-0.5 opacity-80">
                {day.usable ? "Usable" : "Skipped"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
