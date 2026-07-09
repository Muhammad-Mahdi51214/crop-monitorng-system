"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FieldSummary } from "@/lib/api";

type Props = {
  fields: FieldSummary[];
  spatialStats?: { fieldAreaHa: number } | null;
};

export default function CropDistribution({ fields, spatialStats }: Props) {
  const cropMap = new Map<string, number>();
  for (const field of fields) {
    const crop = field.cropType.toLowerCase();
    cropMap.set(crop, (cropMap.get(crop) ?? 0) + 1);
  }

  const data = Array.from(cropMap.entries()).map(([crop, count]) => ({
    crop: crop.charAt(0).toUpperCase() + crop.slice(1),
    fields: count,
    area: spatialStats?.fieldAreaHa ?? count * 2,
  }));

  if (data.length === 0) {
    return <p className="agro-panel-muted">Add fields to see crop distribution.</p>;
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="crop"
            width={56}
            tick={{ fill: "#047857", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 8,
              color: "#022c22",
            }}
          />
          <Bar dataKey="fields" fill="#16a34a" radius={[0, 6, 6, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
