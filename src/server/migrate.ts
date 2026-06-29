import { readFile } from "node:fs/promises";
import path from "node:path";
import { getReadyPool } from "./db";

/**
 * Apply schema.sql to the configured Postgres database. Idempotent — every
 * statement uses `create table if not exists` / `on conflict`, so it is safe to
 * run repeatedly to create or repair tables (services, clients, appointments,
 * app_settings, accounts, payments, …).
 */
export async function applySchema(): Promise<{ ok: boolean; error?: string }> {
  const pool = await getReadyPool();

  if (!pool) {
    return { ok: false, error: "Database is not reachable. Check DATABASE_URL and that Postgres is running." };
  }

  try {
    const sql = await readFile(path.join(process.cwd(), "src", "server", "schema.sql"), "utf8");
    await pool.query(sql);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Migration failed." };
  }
}
