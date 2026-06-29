import { getReadyPool, hasDatabase } from "./db";
import { isEphemeralServerlessRuntime } from "./data-dir";
import { applySchema } from "./migrate";

export type DurableStorageState =
  | { ok: true }
  | { ok: false; error: string };

const MISSING_DATABASE =
  "This Vercel deployment needs a PostgreSQL DATABASE_URL before admin sign-in and data changes can work. Add the database in Vercel, then redeploy.";

const UNREACHABLE_DATABASE =
  "The configured PostgreSQL database cannot be reached. Check DATABASE_URL in Vercel, then redeploy.";

/**
 * Vercel's filesystem is temporary and cannot safely hold accounts, sessions,
 * appointments, or services. Normal Node servers may continue using the JSON
 * store, while serverless deployments must have a reachable Postgres database.
 * A fresh database is bootstrapped before the first login.
 */
export async function prepareDurableStorage(): Promise<DurableStorageState> {
  if (!isEphemeralServerlessRuntime()) return { ok: true };
  if (!hasDatabase()) return { ok: false, error: MISSING_DATABASE };

  const pool = await getReadyPool();
  if (!pool) return { ok: false, error: UNREACHABLE_DATABASE };

  try {
    const result = await pool.query<{
      accounts: string | null;
      services: string | null;
      appointments: string | null;
      appSettings: string | null;
    }>(`
      select
        to_regclass('public.accounts')::text as accounts,
        to_regclass('public.services')::text as services,
        to_regclass('public.appointments')::text as appointments,
        to_regclass('public.app_settings')::text as "appSettings"
    `);
    const tables = result.rows[0];
    const schemaReady = Boolean(
      tables?.accounts && tables.services && tables.appointments && tables.appSettings,
    );

    if (!schemaReady) {
      const migration = await applySchema();
      if (!migration.ok) {
        return {
          ok: false,
          error: `The database is connected, but its tables could not be created: ${migration.error ?? "unknown error"}`,
        };
      }
    }

    return { ok: true };
  } catch {
    return { ok: false, error: UNREACHABLE_DATABASE };
  }
}
