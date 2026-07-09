"use client";

import DataQualityCalendar from "@/components/DataQualityCalendar";
import FieldHealthSummary from "@/components/FieldHealthSummary";
import ImageryCautionBanner from "@/components/ImageryCautionBanner";
import HealthBadge from "@/components/HealthBadge";
import IndexTrendChart from "@/components/IndexTrendChart";
import type {
  AnalysisResult,
  FieldDetail,
  FieldSummary,
  HistoryPoint,
  QualityDay,
} from "@/lib/api";
import CropDistribution from "./CropDistribution";
import GlassCard from "./GlassCard";
import HealthHeatmap from "./HealthHeatmap";
import ResilienceGauge from "./ResilienceGauge";

function colorToScore(color: string | undefined): number {
  if (color === "green") return 8.5;
  if (color === "yellow") return 6.5;
  if (color === "red") return 4;
  return 5;
}

function fieldCenter(boundary?: FieldDetail["boundary"]): string {
  if (!boundary?.coordinates?.[0]?.length) return "—";
  const ring = boundary.coordinates[0];
  const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
}

type Props = {
  field: FieldDetail | null;
  analysis: AnalysisResult | null;
  history: HistoryPoint[];
  qualityDays: QualityDay[];
  fields: FieldSummary[];
  selectedId: string | null;
  onSelectField: (id: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export default function FieldReportPanel({
  field,
  analysis,
  history,
  qualityDays,
  fields,
  selectedId,
  onSelectField,
  onRefresh,
  refreshing,
}: Props) {
  const stats = analysis?.spatialStats;
  const healthColor = analysis?.color;
  const score = colorToScore(healthColor);
  const scoreLabel =
    healthColor === "green"
      ? "Good"
      : healthColor === "yellow"
        ? "Watch"
        : healthColor === "red"
          ? "Alert"
          : "Unknown";

  const greenPct = stats?.greenness.goodPercent ?? 33;
  const stressPct = stats?.waterStress.lowPercent ?? 33;
  const chloroLowPct = stats?.chlorophyll.lowPercent ?? 33;

  if (!selectedId || !field) {
    return (
      <GlassCard title="Crop report">
        <p className="agro-panel-muted">
          Select a field in Crop Management to view its satellite report here.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.1rem] font-semibold text-[#1A1F1C]">{field.name}</h1>
          <p className="mt-1 text-sm capitalize text-[#5C6B63]">
            {field.cropType} · {fieldCenter(field.boundary)}
          </p>
        </div>
        {analysis && <HealthBadge color={analysis.color} label={analysis.label} large />}
      </div>

      {analysis?.imageryCaution && (
        <ImageryCautionBanner message={analysis.imageryCaution} />
      )}

      {analysis?.analysisStatus === "no_clear_imagery" && analysis.message && (
        <ImageryCautionBanner message={analysis.message} variant="info" />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <GlassCard className="lg:col-span-5" title="Field overview">
          <p className="text-sm text-[#5C6B63]">
            {analysis?.capture?.datetime
              ? new Date(analysis.capture.datetime).toLocaleString()
              : "No satellite capture yet"}
          </p>

          <div className="mt-6 flex flex-col items-center sm:flex-row sm:justify-around">
            <ResilienceGauge
              score={score}
              label={scoreLabel}
              trend={
                analysis?.anomalies?.ndvi != null
                  ? `Greenness trend z ${analysis.anomalies.ndvi.toFixed(1)}`
                  : undefined
              }
            />
            <div className="mt-4 space-y-2 text-sm text-[#5C6B63] sm:mt-0">
              <p>
                <span className="text-[#5C6B63]">Total area</span>{" "}
                <strong className="text-[#1A1F1C]">{stats?.fieldAreaHa ?? "—"} ha</strong>
              </p>
              <p>
                <span className="text-[#5C6B63]">Clear pixels</span>{" "}
                <strong className="text-[#1A1F1C]">
                  {analysis?.capture?.validPixelPercent ?? "—"}%
                </strong>
              </p>
              <p>
                <span className="text-[#5C6B63]">Cloud cover</span>{" "}
                <strong className="text-[#1A1F1C]">
                  {analysis?.capture?.cloudCoverPercent ?? "—"}%
                </strong>
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {fields.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelectField(f.id)}
                className={`agro-field-pill rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                  selectedId === f.id ? "agro-field-pill-active" : "agro-field-pill-inactive"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="agro-btn-primary mt-5 w-full disabled:opacity-50 sm:w-auto"
          >
            {refreshing ? "Updating satellite data..." : "Refresh satellite"}
          </button>
        </GlassCard>

        <GlassCard className="lg:col-span-7" title="Field health map">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[#1A1F1C]">
                <span>Greenness (healthy)</span>
                <span className="font-semibold text-[#1E7A34]">{greenPct}%</span>
              </div>
              <div className="flex justify-between text-[#1A1F1C]">
                <span>Water stress</span>
                <span className="font-semibold text-[#D64545]">{stressPct}%</span>
              </div>
              <div className="flex justify-between text-[#1A1F1C]">
                <span>Chlorophyll (low vigor)</span>
                <span className="font-semibold text-[#E8A33D]">
                  {stats?.chlorophyll.lowPercent ?? "—"}%
                </span>
              </div>
            </div>
            <HealthHeatmap
              greennessHealthyPercent={greenPct}
              waterStressPercent={stressPct}
              chlorophyllLowPercent={chloroLowPct}
            />
          </div>
          {analysis?.fieldSummary && (
            <p className="agro-summary-box">{analysis.fieldSummary}</p>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-4" title="Satellite indices">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Greenness", value: analysis?.indices?.ndvi },
              { label: "Chlorophyll", value: analysis?.indices?.ndre },
              { label: "Water (NDMI)", value: analysis?.indices?.ndwi },
            ].map((item) => (
              <div key={item.label} className="agro-stat-box">
                <p className="label">{item.label}</p>
                <p className="value">{item.value != null ? item.value.toFixed(2) : "—"}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#5C6B63]">
            {analysis?.message ?? "Run a refresh to load indices."}
          </p>
        </GlassCard>

        <GlassCard className="lg:col-span-5" title="Index trends">
          <div className="h-52">
            <IndexTrendChart points={history} />
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-3" title="Crop distribution">
          <CropDistribution fields={fields} spatialStats={stats} />
        </GlassCard>

        <div className="lg:col-span-6">
          <FieldHealthSummary
            stats={stats}
            cropType={field.cropType}
            summary={analysis?.fieldSummary}
          />
        </div>

        <GlassCard className="lg:col-span-6" title="Data quality">
          <DataQualityCalendar days={qualityDays} />
        </GlassCard>
      </div>
    </div>
  );
}
