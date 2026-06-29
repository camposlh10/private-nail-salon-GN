import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDataDir } from "./data-dir";

/**
 * Receipt / file uploads saved under .data/uploads (gitignored). Served back
 * through /api/uploads/[name]. Filenames are random UUIDs so URLs are
 * unguessable, and the serve route is admin-guarded.
 */

const uploadsDir = path.join(getDataDir(), "uploads");

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

const TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function saveUpload(file: File): Promise<{ url: string; name: string }> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new Error("Only image or PDF receipts are allowed.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Receipt is too large (max 8MB).");

  await mkdir(uploadsDir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, name), buffer);

  return { url: `/api/uploads/${name}`, name };
}

export async function readUpload(name: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null; // guard against path traversal
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = TYPE_BY_EXT[ext];
  if (!contentType) return null;

  try {
    const body = await readFile(path.join(uploadsDir, name));
    return { body, contentType };
  } catch {
    return null;
  }
}
