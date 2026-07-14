const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? `API error ${res.status}`);
  }

  return body as T;
}

export type FieldSummary = {
  id: string;
  name: string;
  cropType: string;
  createdAt: string;
  latestStatus: {
    color: string;
    label: string;
    message: string;
    analyzedAt: string;
  } | null;
};

export type GeoPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export type FieldDetail = {
  id: string;
  name: string;
  cropType: string;
  createdAt: string;
  boundary: GeoPolygon;
};

export type CaptureMetadata = {
  datetime: string | null;
  platform: string | null;
  sensor: string | null;
  productLevel: string | null;
  dataSource: string | null;
  cloudCoverPercent: number | null;
  validPixelPercent: number | null;
  sceneId: string | null;
};

export type FieldImagery = {
  satelliteUrl: string;
  ndviUrl: string;
  ndreUrl: string;
  ndwiUrl: string;
  bounds: [number, number, number, number];
};

export type IndexZoneBreakdown = {
  mean?: number;
  lowPercent: number;
  moderatePercent: number;
  goodPercent: number;
  lowAreaHa: number;
  moderateAreaHa: number;
  goodAreaHa: number;
  lowLabel: string;
  moderateLabel: string;
  goodLabel: string;
};

export type SpatialStats = {
  fieldAreaHa: number;
  analyzedAreaHa: number;
  greenness: IndexZoneBreakdown;
  chlorophyll: IndexZoneBreakdown;
  waterStress: IndexZoneBreakdown;
  primaryConcern: string;
};

export type AnalysisResult = {
  analysisStatus?: string;
  color: string;
  label: string;
  message: string;
  analyzedAt?: string;
  capture?: CaptureMetadata | null;
  indices?: {
    ndvi: number | null;
    ndre: number | null;
    ndwi: number | null;
  };
  anomalies?: {
    ndvi: number | null;
    ndre: number | null;
  };
  imagery?: FieldImagery | null;
  spatialStats?: SpatialStats | null;
  fieldSummary?: string | null;
  isLatestScene?: boolean;
  imageryCaution?: string | null;
  details?: {
    greennessScore: number | null;
    anomalyZscore: number | null;
    ndreScore?: number | null;
    ndwiScore?: number | null;
  };
};

export type HistoryPoint = {
  date: string;
  greennessScore: number | null;
  ndreScore?: number | null;
  ndwiScore?: number | null;
  color: string;
};

export type QualityDay = {
  date: string;
  status: string;
  usable: boolean;
  cloudCoverPercent: number | null;
  validPixelPercent: number | null;
};

export type MapOverviewField = {
  id: string;
  name: string;
  cropType: string;
  boundary: GeoPolygon;
  statusColor: string | null;
  statusLabel: string | null;
  imagery: FieldImagery | null;
};

export type MapLayerType = "satellite" | "ndvi" | "ndre" | "ndwi";

export const api = {
  health: () => apiFetch<{ status: string; database: string }>("/health"),

  listFields: () => apiFetch<{ fields: FieldSummary[] }>("/fields"),

  getMapOverview: () =>
    apiFetch<{ fields: MapOverviewField[] }>("/fields/map-overview"),

  createField: (data: {
    name: string;
    cropType: string;
    boundary: GeoPolygon;
  }) =>
    apiFetch<{ id: string }>("/fields", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        cropType: data.cropType,
        boundary: data.boundary,
      }),
    }),

  getField: (id: string) => apiFetch<FieldDetail>(`/fields/${id}`),

  getAnalysis: (id: string) =>
    apiFetch<AnalysisResult>(`/fields/${id}/analysis/latest`),

  getHistory: (id: string) =>
    apiFetch<{ points: HistoryPoint[] }>(`/fields/${id}/history`),

  getQualityCalendar: (id: string) =>
    apiFetch<{ days: QualityDay[] }>(`/fields/${id}/analysis/quality-calendar`),

  refreshField: (id: string) =>
    apiFetch<AnalysisResult>(`/fields/${id}/refresh`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  chat: (
    message: string,
    options?: {
      fieldId?: string;
      activeFieldName?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    },
  ) =>
    apiFetch<{ reply: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        fieldId: options?.fieldId,
        activeFieldName: options?.activeFieldName,
        history: options?.history,
      }),
    }),
};
