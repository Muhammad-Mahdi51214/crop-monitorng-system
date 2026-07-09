import { Router, type Request } from "express";
import { query } from "../db/pool.js";
import {
  emptyAnalysisResponse,
  formatAnalysisRow,
  getQualityCalendar,
  refreshFieldAnalysis,
  type AnalysisRow,
} from "../services/fieldData.js";

type FieldParams = { id: string };

export const analysisRouter = Router({ mergeParams: true });

analysisRouter.get("/analysis/latest", async (req: Request<FieldParams>, res, next) => {
  try {
    const fieldId = req.params.id;

    const result = await query<AnalysisRow & { crop_type: string }>(
      `
      SELECT a.*, f.crop_type
      FROM field_analyses a
      JOIN fields f ON f.id = a.field_id
      WHERE a.field_id = $1
      ORDER BY a.analyzed_at DESC
      LIMIT 1
    `,
      [fieldId],
    );

    const analysis = result.rows[0];
    if (!analysis) {
      res.json(emptyAnalysisResponse());
      return;
    }

    res.json(formatAnalysisRow(analysis, analysis.crop_type));
  } catch (err) {
    next(err);
  }
});

analysisRouter.get("/analysis/quality-calendar", async (req: Request<FieldParams>, res, next) => {
  try {
    const days = await getQualityCalendar(req.params.id);
    res.json({ days });
  } catch (err) {
    next(err);
  }
});

analysisRouter.get("/history", async (req: Request<FieldParams>, res, next) => {
  try {
    const fieldId = req.params.id;

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

    res.json({
      points: result.rows.map((row) => ({
        date: row.analyzed_at,
        greennessScore: row.ndvi_mean,
        ndreScore: row.ndre_mean,
        ndwiScore: row.ndwi_mean,
        color: row.status_color,
      })),
    });
  } catch (err) {
    next(err);
  }
});

analysisRouter.post("/refresh", async (req: Request<FieldParams>, res, next) => {
  try {
    const fieldId = req.params.id;
    const result = await refreshFieldAnalysis(fieldId);

    if (!result) {
      res.status(404).json({ error: "Field not found" });
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});
