import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
      // Fail fast instead of hanging when the DB is unreachable / misconfigured.
      connectionTimeoutMillis: 4000,
    });

    // Without a listener, a pool-level error (e.g. an idle client dropping)
    // would crash the process with an unhandled 'error' event.
    pool.on("error", () => {
      probeState = "down";
      probedAt = Date.now();
    });
  }

  return pool;
}

/**
 * Whether Postgres is actually reachable — not merely configured. Probed once
 * and cached; a "down" result is re-checked after a short TTL so the app can
 * recover if the database comes back. This is the single source of truth for
 * deciding between the Postgres path and the JSON demo store, so a bad
 * DATABASE_URL degrades gracefully instead of throwing on every write.
 */
type ProbeState = "unknown" | "ready" | "down";
let probeState: ProbeState = "unknown";
let probedAt = 0;
let probePromise: Promise<boolean> | null = null;
const DOWN_TTL_MS = 15000;

export async function isDbReady(): Promise<boolean> {
  const activePool = getPool();
  if (!activePool) return false;

  if (probeState === "ready") return true;
  if (probeState === "down" && Date.now() - probedAt < DOWN_TTL_MS) return false;

  if (!probePromise) {
    probePromise = (async () => {
      try {
        await activePool.query("select 1");
        probeState = "ready";
        return true;
      } catch {
        probeState = "down";
        return false;
      } finally {
        probedAt = Date.now();
        probePromise = null;
      }
    })();
  }

  return probePromise;
}

/** The pool only when the database is actually reachable, else null. */
export async function getReadyPool(): Promise<Pool | null> {
  return (await isDbReady()) ? getPool() : null;
}

export async function queryRows<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const activePool = await getReadyPool();

  if (!activePool) {
    return null;
  }

  try {
    const result = await activePool.query<T>(sql, params);
    return result.rows;
  } catch (error) {
    console.warn("PostgreSQL query failed; using demo data.", error instanceof Error ? error.message : error);
    probeState = "down";
    probedAt = Date.now();
    return null;
  }
}
