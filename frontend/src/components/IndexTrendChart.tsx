"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint } from "@/lib/api";

type Props = {
  points: HistoryPoint[];
  dark?: boolean;
};

export default function IndexTrendChart({ points, dark }: Props) {
  if (points.length === 0) {
    return (
      <p className={`text-sm ${dark ? "text-white/60" : "text-emerald-700"}`}>
        No trend yet — refresh satellite data to start building your field history.
      </p>
    );
  }

  const data = points.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    ndvi: p.greennessScore,
    ndre: p.ndreScore,
    ndwi: p.ndwiScore,
  }));

  const gridStroke = dark ? "rgba(255,255,255,0.1)" : "#d1fae5";
  const axisStroke = dark ? "rgba(255,255,255,0.6)" : "#047857";

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} />
          <YAxis domain={[-0.2, 1]} tick={{ fontSize: 11, fill: axisStroke }} stroke={axisStroke} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="ndvi"
            name="Greenness (NDVI)"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="ndre"
            name="Chlorophyll (NDRE)"
            stroke="#0d9488"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="ndwi"
            name="Water (NDWI)"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
