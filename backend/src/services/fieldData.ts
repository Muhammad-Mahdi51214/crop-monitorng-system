import { query } from "../db/pool.js";
import {
  buildFarmerSpatialSummary,
  type SpatialStats,
} from "./indexInterpretation.js";
import { toFarmerStatus } from "./farmerTranslate.js";
import {
  runSatelliteAnalysis,
  type ImageBounds,
} from "./satelliteAnalysis.js";

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

export type ImageryUrls = {
  satelliteUrl: string;
  ndviUrl: string;
  ndreUrl: string;
  ndwiUrl: string;
  bounds: ImageBounds;
};

export function buildImageryResponse(
  satelliteImage?: string | null,
  ndviImage?: string | null,
  ndreImage?: string | null,
  ndwiImage?: string | null,
  imageBounds?: ImageBounds | null,
): ImageryUrls | null {
  if (!satelliteImage || !ndviImage || !ndreImage || !ndwiImage || !imageBounds) {
    return null;
  }
  return {
    satelliteUrl: `/imagery/${satelliteImage}`,
    ndviUrl: `/imagery/${ndviImage}`,
    ndreUrl: `/imagery/${ndreImage}`,
    ndwiUrl: `/imagery/${ndwiImage}`,
    bounds: imageBounds,
  };
}

export function buildCapture(row: {
  scene_datetime?: string | null;
  analyzed_at?: string;
  platform?: string | null;
  sensor?: string | null;
  product_level?: string | null;
  data_source?: string | null;
  cloud_cover_percent?: number | null;
  valid_pixel_percent?: number | null;
  scene_id?: string | null;
}): CaptureMetadata {
  return {
    datetime: row.scene_datetime ?? row.analyzed_at ?? null,
    platform: row.platform ?? null,
    sensor: row.sensor ?? "MSI",
    productLevel: row.product_level ?? "L2A",
    dataSource: row.data_source ?? null,
    cloudCoverPercent: row.cloud_cover_percent ?? null,
    validPixelPercent: row.valid_pixel_percent ?? null,
    sceneId: row.scene_id ?? null,
  };
}

export function emptyAnalysisResponse() {
  return {
    analysisStatus: "none",
    color: "gray",
    label: "No data yet",
    message: "Run a refresh to fetch satellite data for this field.",
    imagery: null,
    capture: null,
    indices: { ndvi: null, ndre: null, ndwi: null },
    anomalies: { ndvi: null, ndre: null },
    spatialStats: null,
    fieldSummary: null,
  };
}

export function formatAnalysisRow(row: AnalysisRow, cropType?: string) {
  const imagery = buildImageryResponse(
    row.satellite_image,
    row.ndvi_image,
    row.ndre_image,
    row.ndwi_image,
    row.image_bounds,
  );

  return {
    analysisStatus: row.analysis_status ?? "ok",
    color: row.status_color,
    label: row.status_label,
    message: row.status_message,
    analyzedAt: row.analyzed_at,
    capture: buildCapture(row),
    indices: {
      ndvi: row.ndvi_mean,
      ndre: row.ndre_mean,
      ndwi: row.ndwi_mean,
    },
    anomalies: {
      ndvi: row.anomaly_zscore,
      ndre: row.anomaly_zscore_ndre,
    },
    imagery,
    details: {
      greennessScore: row.ndvi_mean,
      anomalyZscore: row.anomaly_zscore,
      ndreScore: row.ndre_mean,
      ndwiScore: row.ndwi_mean,
    },
    spatialStats: row.spatial_stats ?? null,
    fieldSummary:
      row.spatial_stats && cropType
        ? buildFarmerSpatialSummary(row.spatial_stats, cropType)
        : null,
    isLatestScene: row.is_latest_scene !== false,
    imageryCaution: row.imagery_caution ?? null,
  };
}

export type AnalysisRow = {
  analysis_status: string | null;
  status_color: string;
  status_label: string;
  status_message: string;
  analyzed_at: string;
  ndvi_mean: number | null;
  ndre_mean: number | null;
  ndwi_mean: number | null;
  anomaly_zscore: number | null;
  anomaly_zscore_ndre: number | null;
  valid_pixel_percent: number | null;
  cloud_cover_percent: number | null;
  scene_datetime: string | null;
  platform: string | null;
  sensor: string | null;
  product_level: string | null;
  data_source: string | null;
  scene_id: string | null;
  satellite_image: string | null;
  ndvi_image: string | null;
  ndre_image: string | null;
  ndwi_image: string | null;
  image_bounds: ImageBounds | null;
  spatial_stats: SpatialStats | null;
  is_latest_scene: boolean | null;
  imagery_caution: string | null;
};

export async function refreshFieldAnalysis(fieldId: string) {
  const fieldResult = await query<{
    id: string;
    crop_type: string;
    boundary: object;
  }>(
    `
    SELECT id, crop_type, ST_AsGeoJSON(boundary)::json AS boundary
    FROM fields WHERE id = $1
  `,
    [fieldId],
  );

  const field = fieldResult.rows[0];
  if (!field) return null;

  const historyResult = await query<{
    ndvi_mean: number | null;
    ndre_mean: number | null;
    ndwi_mean: number | null;
  }>(
    `
    SELECT ndvi_mean, ndre_mean, ndwi_mean
    FROM field_analyses
    WHERE field_id = $1 AND analysis_status = 'ok'
    ORDER BY analyzed_at ASC
    LIMIT 52
  `,
    [fieldId],
  );

  const historyNdvi = historyResult.rows
    .map((r) => r.ndvi_mean)
    .filter((v): v is number => v !== null);
  const historyNdre = historyResult.rows
    .map((r) => r.ndre_mean)
    .filter((v): v is number => v !== null);
  const historyNdwi = historyResult.rows
    .map((r) => r.ndwi_mean)
    .filter((v): v is number => v !== null);

  const analysis = await runSatelliteAnalysis(
    fieldId,
    field.boundary,
    field.crop_type,
    historyNdvi,
    historyNdre,
    historyNdwi,
  );

  if (!analysis.ok || analysis.analysisStatus === "no_clear_imagery") {
    await query(
      `
      INSERT INTO field_analyses (
        field_id, ndvi_mean, anomaly_zscore,
        status_color, status_label, status_message,
        analysis_status
      )
      VALUES ($1, NULL, NULL, 'gray', 'No clear imagery', $2, 'no_clear_imagery')
    `,
      [fieldId, analysis.message ?? "No clear satellite picture available yet."],
    );

    return {
      analysisStatus: "no_clear_imagery",
      color: "gray",
      label: "No clear imagery",
      message:
        analysis.message ??
        "No clear satellite picture available yet for this field — we'll check again when skies are clearer.",
      imagery: null,
      capture: null,
    };
  }

  const status = toFarmerStatus(
    analysis.anomalyZscore ?? 0,
    analysis.anomalyZscoreNdre ?? 0,
    analysis.anomalyZscoreNdwi ?? 0,
  );

  const insertResult = await query<AnalysisRow>(
    `
    INSERT INTO field_analyses (
      field_id, ndvi_mean, ndre_mean, ndwi_mean,
      anomaly_zscore, anomaly_zscore_ndre,
      status_color, status_label, status_message,
      scene_id, satellite_image, ndvi_image, ndre_image, ndwi_image,
      image_bounds, valid_pixel_percent, cloud_cover_percent,
      scene_datetime, platform, product_level, data_source, sensor,
      analysis_status, spatial_stats, is_latest_scene, imagery_caution
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'ok',$23,$24,$25)
    RETURNING *
  `,
    [
      fieldId,
      analysis.ndviMean,
      analysis.ndreMean,
      analysis.ndwiMean,
      analysis.anomalyZscore,
      analysis.anomalyZscoreNdre,
      status.color,
      status.label,
      status.message,
      analysis.sceneId,
      analysis.satelliteImage,
      analysis.ndviImage,
      analysis.ndreImage,
      analysis.ndwiImage,
      analysis.imageBounds ? JSON.stringify(analysis.imageBounds) : null,
      analysis.validPixelPercent,
      analysis.cloudCoverPercent,
      analysis.sceneDatetime,
      analysis.platform,
      analysis.productLevel,
      analysis.dataSource,
      analysis.sensor,
      analysis.spatialStats ? JSON.stringify(analysis.spatialStats) : null,
      analysis.isLatestScene !== false,
      analysis.imageryCaution ?? null,
    ],
  );

  return formatAnalysisRow(insertResult.rows[0], field.crop_type);
}

export async function getLatestAnalysis(fieldId: string) {
  const result = await query<AnalysisRow>(
    `
    SELECT *
    FROM field_analyses
    WHERE field_id = $1 AND analysis_status = 'ok'
    ORDER BY analyzed_at DESC
    LIMIT 1
  `,
    [fieldId],
  );
  return result.rows[0] ?? null;
}

export async function getQualityCalendar(fieldId: string) {
  const result = await query<{
    analyzed_at: string;
    analysis_status: string;
    cloud_cover_percent: number | null;
    valid_pixel_percent: number | null;
    scene_datetime: string | null;
  }>(
    `
    SELECT analyzed_at, analysis_status, cloud_cover_percent,
           valid_pixel_percent, scene_datetime
    FROM field_analyses
    WHERE field_id = $1
      AND analyzed_at >= NOW() - INTERVAL '30 days'
    ORDER BY analyzed_at DESC
    LIMIT 30
  `,
    [fieldId],
  );

  return result.rows.map((row) => ({
    date: row.scene_datetime ?? row.analyzed_at,
    status: row.analysis_status,
    usable: row.analysis_status === "ok",
    cloudCoverPercent: row.cloud_cover_percent,
    validPixelPercent: row.valid_pixel_percent,
  }));
}

export async function getFieldStatus(fieldId: string) {
  const result = await query<{
    name: string;
    crop_type: string;
    status_color: string;
    status_label: string;
    status_message: string;
    ndvi_mean: number | null;
    ndre_mean: number | null;
    ndwi_mean: number | null;
    anomaly_zscore: number | null;
    anomaly_zscore_ndre: number | null;
    analyzed_at: string;
    valid_pixel_percent: number | null;
    cloud_cover_percent: number | null;
    scene_datetime: string | null;
    platform: string | null;
    data_source: string | null;
    spatial_stats: SpatialStats | null;
  }>(
    `
    SELECT
      f.name, f.crop_type,
      a.status_color, a.status_label, a.status_message,
      a.ndvi_mean, a.ndre_mean, a.ndwi_mean,
      a.anomaly_zscore, a.anomaly_zscore_ndre, a.analyzed_at,
      a.valid_pixel_percent, a.cloud_cover_percent,
      a.scene_datetime, a.platform, a.data_source,
      a.spatial_stats
    FROM fields f
    LEFT JOIN LATERAL (
      SELECT * FROM field_analyses
      WHERE field_id = f.id AND analysis_status = 'ok'
      ORDER BY analyzed_at DESC LIMIT 1
    ) a ON true
    WHERE f.id = $1
  `,
    [fieldId],
  );

  return result.rows[0] ?? null;
}

export async function getFieldHistory(fieldId: string) {
  const result = await query<{
    ndvi_mean: number | null;
    ndre_mean: number | null;
    ndwi_mean: number | null;
    analyzed_at: string;
    status_color: string;
  }>(
    `
    SELECT ndvi_mean, ndre_mean, ndwi_mean, analyzed_at, status_color
    FROM field_analyses
    WHERE field_id = $1 AND analysis_status = 'ok'
    ORDER BY analyzed_at ASC
    LIMIT 52
  `,
    [fieldId],
  );

  return result.rows;
}

export async function getFieldInfo(fieldId: string) {
  const result = await query<{
    id: string;
    name: string;
    crop_type: string;
    created_at: string;
  }>(`SELECT id, name, crop_type, created_at FROM fields WHERE id = $1`, [
    fieldId,
  ]);

  return result.rows[0] ?? null;
}

export async function listFieldsSummary() {
  const result = await query<{
    id: string;
    name: string;
    crop_type: string;
    status_color: string | null;
    status_label: string | null;
    analyzed_at: string | null;
  }>(
    `
    SELECT
      f.id,
      f.name,
      f.crop_type,
      a.status_color,
      a.status_label,
      a.analyzed_at
    FROM fields f
    LEFT JOIN LATERAL (
      SELECT status_color, status_label, analyzed_at
      FROM field_analyses
      WHERE field_id = f.id AND analysis_status = 'ok'
      ORDER BY analyzed_at DESC
      LIMIT 1
    ) a ON true
    ORDER BY f.name ASC
  `,
  );

  return result.rows;
}

export async function findFields(params: {
  nameQuery?: string;
  cropType?: string;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.nameQuery?.trim()) {
    values.push(`%${params.nameQuery.trim().replace(/[%_]/g, "")}%`);
    conditions.push(`f.name ILIKE $${values.length}`);
  }
  if (params.cropType?.trim()) {
    values.push(params.cropType.trim().toLowerCase());
    conditions.push(`LOWER(f.crop_type) = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query<{
    id: string;
    name: string;
    crop_type: string;
    status_color: string | null;
    status_label: string | null;
  }>(
    `
    SELECT
      f.id,
      f.name,
      f.crop_type,
      a.status_color,
      a.status_label
    FROM fields f
    LEFT JOIN LATERAL (
      SELECT status_color, status_label
      FROM field_analyses
      WHERE field_id = f.id AND analysis_status = 'ok'
      ORDER BY analyzed_at DESC
      LIMIT 1
    ) a ON true
    ${where}
    ORDER BY f.name ASC
    LIMIT 20
  `,
    values,
  );

  return result.rows;
}
