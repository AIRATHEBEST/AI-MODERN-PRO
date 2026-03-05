import * as fs from "fs";
import * as path from "path";
import express from "express";

/**
 * Local disk storage with optional S3 fallback.
 * Files are stored in ./uploads/ relative to project root.
 * This is fully plug-and-play with no external dependencies required.
 */

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  ensureUploadsDir();
  const key = relKey.replace(/^\/+/, "").replace(/[^a-zA-Z0-9._\-\/]/g, "_");
  const filePath = path.join(UPLOADS_DIR, key.replace(/\//g, "_"));
  
  const buffer = typeof data === "string"
    ? Buffer.from(data, "base64")
    : Buffer.from(data);
  
  fs.writeFileSync(filePath, buffer);
  
  // Return a URL that the Express server will serve
  const urlKey = path.basename(filePath);
  return { key: urlKey, url: `/uploads/${urlKey}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  return { key, url: `/uploads/${key}` };
}

export function registerUploadsRoute(app: import("express").Express) {
  ensureUploadsDir();
  app.use("/uploads", express.static(UPLOADS_DIR));
}
