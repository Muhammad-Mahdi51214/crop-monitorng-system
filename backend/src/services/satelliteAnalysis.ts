import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import type { SpatialStats } from "./indexInterpretation.js";

export type ImageBounds = [number, number, number, number];

export type SatelliteAnalysisResult = {
  ok: boolean;
  status?: string;
  message?: string;
  analysisStatus?: string;
  ndviMean?: number;
  ndreMean?: number;
  ndwiMean?: number;
  anomalyZscore?: number;
  anomalyZscoreNdre?: number;
  anomalyZscoreNdwi?: number;
  sceneId?: string;
  sceneDate?: string;
  sceneDatetime?: string;
  platform?: string;
  productLevel?: string;
  dataSource?: string;
  sensor?: string;
  validPixelPercent?: number;
  cloudCoverPercent?: number;
  scenesUsed?: number;
  scenesTried?: number;
  isLatestScene?: boolean;
  imageryCaution?: string | null;
  satelliteImage?: string;
  ndviImage?: string;
  ndreImage?: string;
  ndwiImage?: string;
  imageBounds?: ImageBounds;
  spatialStats?: SpatialStats;
};

const workerDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "python-worker",
);

export const imageryOutputDir = path.join(workerDir, "output");

export async function runSatelliteAnalysis(
  fieldId: string,
  boundary: object,
  cropType: string,
  historyNdvi: number[] = [],
  historyNdre: number[] = [],
  historyNdwi: number[] = [],
): Promise<SatelliteAnalysisResult> {
  const scriptPath = path.join(workerDir, "analyze_field.py");
  const payload = JSON.stringify({
    field_id: fieldId,
    crop_type: cropType,
    boundary,
    stac_api_url: env.STAC_API_URL,
    cdse_catalog_url: env.CDSE_CATALOG_URL,
    cdse_client_id: env.CDSE_CLIENT_ID,
    cdse_client_secret: env.CDSE_CLIENT_SECRET,
    earthsearch_fallback: env.EARTHSEARCH_FALLBACK,
    max_cloud_cover_percent: env.MAX_CLOUD_COVER_PERCENT,
    min_valid_pixel_percent: env.MIN_VALID_PIXEL_PERCENT,
    history_ndvi: historyNdvi,
    history_ndre: historyNdre,
    history_ndwi: historyNdwi,
    output_dir: imageryOutputDir,
  });

  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env };
    delete childEnv.PROJ_LIB;
    delete childEnv.PROJ_DATA;

    const child = spawn(env.PYTHON_PATH, [scriptPath], {
      cwd: workerDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: childEnv,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start Python worker: ${err.message}`));
    });

    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout.trim() || "{}") as Record<string, unknown>;

        if (parsed.status === "no_clear_imagery" || parsed.analysis_status === "no_clear_imagery") {
          resolve({
            ok: false,
            status: "no_clear_imagery",
            analysisStatus: "no_clear_imagery",
            message: String(
              parsed.message ??
                "No clear satellite picture available yet for this field.",
            ),
          });
          return;
        }

        if (code !== 0 || !parsed.ok) {
          reject(
            new Error(
              String(parsed.error ?? parsed.message ?? stderr.trim() ?? `Satellite analysis failed (exit ${code})`),
            ),
          );
          return;
        }

        resolve({
          ok: true,
          analysisStatus: "ok",
          ndviMean: parsed.ndvi_mean as number,
          ndreMean: parsed.ndre_mean as number,
          ndwiMean: parsed.ndwi_mean as number,
          anomalyZscore: parsed.anomaly_zscore as number,
          anomalyZscoreNdre: parsed.anomaly_zscore_ndre as number,
          anomalyZscoreNdwi: parsed.anomaly_zscore_ndwi as number,
          sceneId: parsed.scene_id as string,
          sceneDate: parsed.scene_date as string,
          sceneDatetime: parsed.scene_datetime as string,
          platform: parsed.platform as string,
          productLevel: parsed.product_level as string,
          dataSource: parsed.data_source as string,
          sensor: parsed.sensor as string,
          validPixelPercent: parsed.valid_pixel_percent as number,
          cloudCoverPercent: parsed.cloud_cover_percent as number,
          scenesUsed: parsed.scenes_used as number,
          scenesTried: parsed.scenes_tried as number,
          isLatestScene: parsed.is_latest_scene !== false,
          imageryCaution: (parsed.imagery_caution as string | null) ?? null,
          satelliteImage: parsed.satellite_image as string,
          ndviImage: parsed.ndvi_image as string,
          ndreImage: parsed.ndre_image as string,
          ndwiImage: parsed.ndwi_image as string,
          imageBounds: parsed.image_bounds as ImageBounds,
          spatialStats: parsed.spatial_stats as SpatialStats,
        });
      } catch {
        reject(
          new Error(
            stderr.trim() || stdout.trim() || "Invalid Python worker output",
          ),
        );
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}
