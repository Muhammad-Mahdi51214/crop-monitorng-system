"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type AnalysisResult,
  type FieldDetail,
  type HistoryPoint,
  type QualityDay,
} from "@/lib/api";
import ChatPanel from "@/components/ChatPanel";
import DataQualityCalendar from "@/components/DataQualityCalendar";
import FieldHealthSummary from "@/components/FieldHealthSummary";
import FieldImageryPanel from "@/components/FieldImageryPanel";
import HealthBadge from "@/components/HealthBadge";
import IndexTrendChart from "@/components/IndexTrendChart";

type Props = {
  field: FieldDetail;
  analysis: AnalysisResult | null;
  history: HistoryPoint[];
  qualityDays: QualityDay[];
};

export default function FieldDetailClient({
  field,
  analysis,
  history,
  qualityDays: initialQuality,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(analysis);
  const [chartPoints, setChartPoints] = useState(history);
  const [qualityDays, setQualityDays] = useState(initialQuality);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(analysis);
  }, [analysis]);

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const result = await api.refreshField(field.id);
      setStatus(result);
      if (result.analysisStatus !== "no_clear_imagery") {
        const [{ points }, { days }] = await Promise.all([
          api.getHistory(field.id),
          api.getQualityCalendar(field.id),
        ]);
        setChartPoints(points);
        setQualityDays(days);
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not refresh satellite data";
      setRefreshError(msg);
      if (msg.includes("No clear satellite")) {
        setStatus({
          analysisStatus: "no_clear_imagery",
          color: "gray",
          label: "No clear imagery",
          message: msg,
          imagery: null,
          capture: null,
        });
      }
    } finally {
      setRefreshing(false);
    }
  }

  const isNoImagery = status?.analysisStatus === "no_clear_imagery";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-emerald-700">{field.cropType}</p>
          <h1 className="text-3xl font-semibold text-emerald-950">{field.name}</h1>
        </div>
        {status && !isNoImagery ? (
          <HealthBadge color={status.color} label={status.label} large />
        ) : (
          <HealthBadge
            color={isNoImagery ? "gray" : "gray"}
            label={isNoImagery ? "No clear imagery" : "Not checked yet"}
            large
          />
        )}
      </header>

      {status && !isNoImagery ? (
        <p className="text-lg text-emerald-900">{status.message}</p>
      ) : isNoImagery ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-lg text-amber-900">
          {status?.message ??
            "No clear satellite picture available yet — recent scenes had too much cloud or missing data. Try again in a few days."}
        </p>
      ) : (
        <p className="text-lg text-emerald-800">
          No satellite check yet. Tap below to see how your field looks from space.
        </p>
      )}

      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        className="rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {refreshing
          ? "Checking the sky for new pictures of your field..."
          : "Check for latest satellite update"}
      </button>
      {refreshError && !isNoImagery && (
        <p className="text-sm text-red-600">{refreshError}</p>
      )}

      <FieldImageryPanel
        boundary={field.boundary}
        imagery={status?.imagery ?? null}
        capture={status?.capture}
      />

      <FieldHealthSummary
        stats={status?.spatialStats}
        cropType={field.cropType}
        summary={status?.fieldSummary}
      />

      <section className="rounded-2xl border border-emerald-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Index trends over time</h2>
        <IndexTrendChart points={chartPoints} />
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Satellite data quality</h2>
        <DataQualityCalendar days={qualityDays} />
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Ask the assistant</h2>
        <ChatPanel fieldId={field.id} fieldName={field.name} />
      </section>
    </div>
  );
}
