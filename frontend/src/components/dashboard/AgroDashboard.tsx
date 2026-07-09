"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  api,
  type AnalysisResult,
  type FieldDetail,
  type FieldSummary,
  type GeoPolygon,
  type HistoryPoint,
  type MapOverviewField,
  type QualityDay,
} from "@/lib/api";
import ChatPanel from "@/components/ChatPanel";
import HealthBadge from "@/components/HealthBadge";
import NewFieldForm from "@/components/NewFieldForm";
import DashboardNav, { type DashboardView } from "./DashboardNav";
import FieldReportPanel from "./FieldReportPanel";
import FieldsOverviewMap from "./FieldsOverviewMap";
import GlassCard from "./GlassCard";
import ImageryCautionBanner from "@/components/ImageryCautionBanner";

export default function AgroDashboard() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<DashboardView>("dashboard");
  const [fields, setFields] = useState<FieldSummary[]>([]);
  const [mapFields, setMapFields] = useState<MapOverviewField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [field, setField] = useState<FieldDetail | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [qualityDays, setQualityDays] = useState<QualityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapFlyRequest, setMapFlyRequest] = useState<{ id: string; at: number } | null>(
    null,
  );
  const bootstrappedRef = useRef(false);

  const loadFields = useCallback(async () => {
    const [{ fields: list }, { fields: mapOverview }] = await Promise.all([
      api.listFields(),
      api.getMapOverview().catch(() => ({ fields: [] as MapOverviewField[] })),
    ]);
    setFields(list);
    setMapFields((prev) => {
      if (!prev.length) return mapOverview;
      const prevById = new Map(prev.map((f) => [f.id, f]));
      const merged = mapOverview.map((f) => {
        const existing = prevById.get(f.id);
        if (
          existing &&
          JSON.stringify(existing.boundary) === JSON.stringify(f.boundary) &&
          JSON.stringify(existing.imagery) === JSON.stringify(f.imagery)
        ) {
          return existing;
        }
        return f;
      });
      const overviewIds = new Set(mapOverview.map((f) => f.id));
      const pending = prev.filter((f) => !overviewIds.has(f.id));
      return pending.length ? [...merged, ...pending] : merged;
    });
    return list;
  }, []);

  const loadFieldData = useCallback(async (id: string) => {
    const [f, hist, qual] = await Promise.all([
      api.getField(id),
      api.getHistory(id).catch(() => ({ points: [] })),
      api.getQualityCalendar(id).catch(() => ({ days: [] })),
    ]);
    setField(f);
    setHistory(hist.points);
    setQualityDays(qual.days);
    const a = await api.getAnalysis(id);
    setAnalysis(a.analysisStatus === "none" ? null : a);
  }, []);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        setLoading(true);
        const list = await loadFields();
        const fromUrl = searchParams.get("field");
        const initial = fromUrl ?? list[0]?.id ?? null;
        setSelectedId(initial);
        if (initial) await loadFieldData(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadFields, loadFieldData, searchParams]);

  async function handleFieldCreated(
    id: string,
    meta: { name: string; cropType: string; boundary: GeoPolygon },
  ) {
    const optimisticSummary: FieldSummary = {
      id,
      name: meta.name,
      cropType: meta.cropType,
      createdAt: new Date().toISOString(),
      latestStatus: null,
    };
    const optimisticMapField: MapOverviewField = {
      id,
      name: meta.name,
      cropType: meta.cropType,
      boundary: meta.boundary,
      statusColor: null,
      statusLabel: null,
      imagery: null,
    };

    setFields((prev) =>
      prev.some((f) => f.id === id) ? prev : [...prev, optimisticSummary],
    );
    setMapFields((prev) =>
      prev.some((f) => f.id === id) ? prev : [...prev, optimisticMapField],
    );
    setView("dashboard");
    setSelectedId(id);
    setMapFlyRequest({ id, at: Date.now() });
    window.history.replaceState(null, "", `/?field=${id}`);

    void loadFieldData(id);
    void loadFields();
  }

  async function selectField(
    id: string,
    options?: { switchView?: DashboardView; flyOnMap?: boolean },
  ) {
    setSelectedId(id);
    setError(null);
    window.history.replaceState(null, "", `/?field=${id}`);
    if (options?.switchView) setView(options.switchView);
    if (options?.flyOnMap) setMapFlyRequest({ id, at: Date.now() });
    await loadFieldData(id);
  }

  async function refresh() {
    if (!selectedId) return;
    setRefreshing(true);
    setError(null);
    try {
      const result = await api.refreshField(selectedId);
      if (result.analysisStatus === "no_clear_imagery") {
        setAnalysis(result);
        setError(null);
      } else if (result.analysisStatus === "none") {
        setAnalysis(null);
      } else {
        setAnalysis(result);
        setError(null);
        const [{ points }, { days }] = await Promise.all([
          api.getHistory(selectedId),
          api.getQualityCalendar(selectedId),
        ]);
        setHistory(points);
        setQualityDays(days);
      }
      await loadFields();
      if (result.analysisStatus !== "no_clear_imagery") {
        await loadFieldData(selectedId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  function handleNavigate(next: DashboardView) {
    setView(next);
    if (next === "reports" && selectedId) {
      loadFieldData(selectedId).catch(() => undefined);
    }
  }

  const isDashboardSplit = view === "dashboard" && fields.length > 0;

  const mainClass = isDashboardSplit
    ? "relative z-10 flex h-[calc(100vh-57px)] flex-col overflow-hidden"
    : "relative z-10 mx-auto max-w-[1600px] px-4 pb-6 pt-0 sm:px-6 sm:pb-8 sm:pt-0";

  return (
    <div
      className={`agro-app relative min-h-screen ${isDashboardSplit ? "agro-dashboard-active" : ""}`}
    >
      <div className="agro-bg" aria-hidden />
      <div className="agro-overlay" aria-hidden />

      <DashboardNav
        active={view}
        onNavigate={handleNavigate}
        onAddField={() => setView("add-field")}
      />

      <main className={mainClass}>
        {error && !isDashboardSplit && (
          <p className="mb-4 shrink-0 rounded-xl border border-[#F3C1C1] bg-[#FBE2E2] px-4 py-3 text-sm text-[#D64545]">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-emerald-100">Loading AgroAI dashboard...</p>
        ) : (
          <>
            {fields.length > 0 && (
              <div
                className={
                  view === "dashboard"
                    ? "relative flex h-full min-h-0 w-full visible opacity-100"
                    : "pointer-events-none invisible fixed left-0 top-[57px] z-0 h-[calc(100vh-57px)] w-full opacity-0"
                }
                aria-hidden={view !== "dashboard"}
              >
                {error && view === "dashboard" && (
                  <ImageryCautionBanner
                    message={error}
                    variant="error"
                    className="absolute left-0 right-0 top-0 z-30 shrink-0 rounded-none border-x-0 border-t-0"
                    onDismiss={() => setError(null)}
                  />
                )}
                <aside className="agro-chat-sidebar flex h-full w-[30%] min-w-[280px] max-w-[400px] shrink-0 flex-col">
                  {selectedId ? (
                    <ChatPanel
                      fieldId={selectedId}
                      fieldName={fields.find((f) => f.id === selectedId)?.name}
                      variant="light"
                      fullHeight
                    />
                  ) : (
                    <p className="p-4 text-sm text-slate-500">Select a field on the map to chat.</p>
                  )}
                </aside>
                <div className="flex h-full min-w-0 flex-1 flex-col">
                  {view === "dashboard" && analysis?.imageryCaution && (
                    <ImageryCautionBanner
                      message={analysis.imageryCaution}
                      className="shrink-0 rounded-none border-x-0 border-t-0"
                    />
                  )}
                  {view === "dashboard" &&
                    analysis?.analysisStatus === "no_clear_imagery" &&
                    analysis.message && (
                      <ImageryCautionBanner
                        message={analysis.message}
                        variant="info"
                        className="shrink-0 rounded-none border-x-0 border-t-0"
                      />
                    )}
                  <FieldsOverviewMap
                    fields={mapFields}
                    selectedId={selectedId}
                    onSelectField={(id) => selectField(id)}
                    fillHeight
                    embedded
                    focusRequest={mapFlyRequest}
                    mapActive={view === "dashboard"}
                  />
                </div>
              </div>
            )}

            {view === "add-field" && (
              <div className="w-full">
                <NewFieldForm
                  onCreated={handleFieldCreated}
                  onCancel={() => setView("dashboard")}
                />
              </div>
            )}

            {view === "reports" && (
              <FieldReportPanel
                field={field}
                analysis={analysis}
                history={history}
                qualityDays={qualityDays}
                fields={fields}
                selectedId={selectedId}
                onSelectField={(id) => selectField(id, { switchView: "reports" })}
                onRefresh={refresh}
                refreshing={refreshing}
              />
            )}

            {view === "crops" && (
              <div className="space-y-5">
                <GlassCard title="Crop Management">
                  <p className="agro-panel-muted mb-4">
                    Select a field below — its full report appears in the{" "}
                    <strong>Crop Report</strong> tab.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => selectField(f.id)}
                        onDoubleClick={() =>
                          selectField(f.id, { switchView: "dashboard", flyOnMap: true })
                        }
                        className={`agro-crop-card ${
                          selectedId === f.id ? "agro-crop-card-active" : ""
                        }`}
                        title="Double-click to open dashboard map at this field"
                      >
                        <p className="text-[1rem] font-semibold text-[#1A1F1C]">{f.name}</p>
                        <p className="mt-1 text-sm capitalize text-[#5C6B63]">{f.cropType}</p>
                        {f.latestStatus && (
                          <div className="mt-3">
                            <HealthBadge
                              color={f.latestStatus.color}
                              label={f.latestStatus.label}
                            />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </GlassCard>
                {selectedId && field && (
                  <p className="text-center text-sm text-[#5C6B63]">
                    Selected: <strong className="text-[#1A1F1C]">{field.name}</strong> — open{" "}
                    <button
                      type="button"
                      onClick={() => handleNavigate("reports")}
                      className="font-semibold text-[#2A7D82] underline transition-colors duration-200 hover:text-[#1d6569]"
                    >
                      Crop Report
                    </button>{" "}
                    for details
                  </p>
                )}
              </div>
            )}

            {view === "dashboard" && fields.length === 0 && (
              <GlassCard title="Welcome to AgroAI">
                <p className="agro-panel-muted mb-4">
                  No fields yet. Add your first field to start satellite monitoring.
                </p>
                <button
                  type="button"
                  onClick={() => setView("add-field")}
                  className="agro-btn-primary"
                >
                  + Add your first field
                </button>
              </GlassCard>
            )}
          </>
        )}
      </main>
    </div>
  );
}
