"use client";

import {
  CartesianGrid,
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
};

export default function GreennessChart({ points }: Props) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-emerald-700">
        No trend yet — refresh satellite data to start building your greenness history.
      </p>
    );
  }

  const data = points.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    score: p.greennessScore,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#047857" />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 12 }}
            stroke="#047857"
            label={{
              value: "Greenness score",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: "#047857" },
            }}
          />
          <Tooltip
            formatter={(value) => [
              typeof value === "number" ? value.toFixed(2) : value,
              "Greenness",
            ]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#059669"
            strokeWidth={2}
            dot={{ fill: "#059669", r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
