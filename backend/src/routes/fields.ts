import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { buildImageryResponse } from "../services/fieldData.js";

const createFieldSchema = z.object({
  name: z.string().min(1).max(120),
  cropType: z.enum(["wheat", "rice", "cotton", "maize", "other"]),
  boundary: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  }),
});

export const fieldsRouter = Router();

fieldsRouter.get("/", async (_req, res, next) => {
  try {
    const result = await query<{
      id: string;
      name: string;
      crop_type: string;
      created_at: string;
      status_color: string | null;
      status_label: string | null;
      status_message: string | null;
      analyzed_at: string | null;
    }>(`
      SELECT
        f.id,
        f.name,
        f.crop_type,
        f.created_at,
        a.status_color,
        a.status_label,
        a.status_message,
        a.analyzed_at
      FROM fields f
      LEFT JOIN LATERAL (
        SELECT status_color, status_label, status_message, analyzed_at
        FROM field_analyses
        WHERE field_id = f.id
        ORDER BY analyzed_at DESC
        LIMIT 1
      ) a ON true
      ORDER BY f.created_at DESC
    `);

    res.json({
      fields: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        cropType: row.crop_type,
        createdAt: row.created_at,
        latestStatus: row.status_color
          ? {
              color: row.status_color,
              label: row.status_label,
              message: row.status_message,
              analyzedAt: row.analyzed_at,
            }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

fieldsRouter.post("/", async (req, res, next) => {
  try {
    const body = createFieldSchema.parse(req.body);
    const geojson = JSON.stringify(body.boundary);

    const result = await query<{
      id: string;
      name: string;
      crop_type: string;
      created_at: string;
    }>(
      `
      INSERT INTO fields (name, crop_type, boundary)
      VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))
      RETURNING id, name, crop_type, created_at
    `,
      [body.name, body.cropType, geojson],
    );

    const field = result.rows[0];
    res.status(201).json({
      id: field.id,
      name: field.name,
      cropType: field.crop_type,
      createdAt: field.created_at,
    });
  } catch (err) {
    next(err);
  }
});

fieldsRouter.get("/map-overview", async (_req, res, next) => {
  try {
    const result = await query<{
      id: string;
      name: string;
      crop_type: string;
      boundary: object;
      status_color: string | null;
      status_label: string | null;
      satellite_image: string | null;
      ndvi_image: string | null;
      ndre_image: string | null;
      ndwi_image: string | null;
      image_bounds: [number, number, number, number] | null;
    }>(`
      SELECT
        f.id,
        f.name,
        f.crop_type,
        ST_AsGeoJSON(f.boundary)::json AS boundary,
        a.status_color,
        a.status_label,
        a.satellite_image,
        a.ndvi_image,
        a.ndre_image,
        a.ndwi_image,
        a.image_bounds
      FROM fields f
      LEFT JOIN LATERAL (
        SELECT status_color, status_label, satellite_image, ndvi_image,
               ndre_image, ndwi_image, image_bounds
        FROM field_analyses
        WHERE field_id = f.id AND analysis_status = 'ok'
        ORDER BY analyzed_at DESC
        LIMIT 1
      ) a ON true
      ORDER BY f.created_at DESC
    `);

    res.json({
      fields: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        cropType: row.crop_type,
        boundary: row.boundary,
        statusColor: row.status_color,
        statusLabel: row.status_label,
        imagery: buildImageryResponse(
          row.satellite_image,
          row.ndvi_image,
          row.ndre_image,
          row.ndwi_image,
          row.image_bounds,
        ),
      })),
    });
  } catch (err) {
    next(err);
  }
});

fieldsRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await query<{
      id: string;
      name: string;
      crop_type: string;
      created_at: string;
      boundary: object;
    }>(
      `
      SELECT
        id,
        name,
        crop_type,
        created_at,
        ST_AsGeoJSON(boundary)::json AS boundary
      FROM fields
      WHERE id = $1
    `,
      [req.params.id],
    );

    const field = result.rows[0];
    if (!field) {
      res.status(404).json({ error: "Field not found" });
      return;
    }

    res.json({
      id: field.id,
      name: field.name,
      cropType: field.crop_type,
      createdAt: field.created_at,
      boundary: field.boundary,
    });
  } catch (err) {
    next(err);
  }
});
