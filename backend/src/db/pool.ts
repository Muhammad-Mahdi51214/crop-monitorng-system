import pg from "pg";
import { env } from "../config/env.js";

const useSsl =
  env.DATABASE_SSL ||
  /supabase\.co|neon\.tech|render\.com/.test(env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
