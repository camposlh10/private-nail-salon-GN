import os from "node:os";
import path from "node:path";

/**
 * Resolve a WRITABLE directory for the JSON file store, auth secret, and uploads.
 *
 * On a normal server (or local dev) this is `<project>/.data`. On serverless
 * platforms (Vercel / AWS Lambda / Netlify) the project directory is read-only
 * — only the OS temp dir is writable — so we fall back to `os.tmpdir()`.
 *
 * IMPORTANT: on serverless, temp storage is EPHEMERAL (wiped on cold starts and
 * not shared between instances). For durable data, set DATABASE_URL to a real
 * Postgres database (the app then stores everything there instead of files), or
 * host on a server with a persistent disk.
 */
let cached: string | null = null;

export function getDataDir(): string {
  if (cached) return cached;

  if (process.env.DATA_DIR) {
    cached = process.env.DATA_DIR;
    return cached;
  }

  const serverless = Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY,
  );

  cached = serverless ? path.join(os.tmpdir(), "nail-studio-data") : path.join(process.cwd(), ".data");
  return cached;
}
