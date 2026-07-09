import "dotenv/config";
import { z } from "zod";

function trimEnv(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function boolEnv(value: unknown, defaultValue: boolean) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
}

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL: z.preprocess(
    (v) => boolEnv(v, false),
    z.boolean(),
  ),
  GROQ_API_KEY: z.preprocess(trimEnv, z.string().min(1).optional()),
  LLM_MODEL: z.preprocess(
    trimEnv,
    z.string().default("llama-3.3-70b-versatile"),
  ),
  STAC_API_URL: z
    .string()
    .url()
    .default("https://earth-search.aws.element84.com/v1"),
  CDSE_CLIENT_ID: z.preprocess(trimEnv, z.string().optional()),
  CDSE_CLIENT_SECRET: z.preprocess(trimEnv, z.string().optional()),
  CDSE_CATALOG_URL: z
    .string()
    .url()
    .default("https://catalogue.dataspace.copernicus.eu/stac"),
  CDSE_PROCESS_URL: z
    .string()
    .url()
    .default("https://sh.dataspace.copernicus.eu/api/v1/process"),
  EARTHSEARCH_FALLBACK: z.preprocess(
    (v) => boolEnv(v, true),
    z.boolean(),
  ),
  MAX_CLOUD_COVER_PERCENT: z.coerce.number().default(20),
  MIN_VALID_PIXEL_PERCENT: z.coerce.number().default(60),
  PYTHON_PATH: z.preprocess(trimEnv, z.string().default("python")),
});

export const env = envSchema.parse(process.env);
