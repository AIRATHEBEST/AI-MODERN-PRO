import puter from 'puter';

/**
 * Storage implementation using Puter.js
 * This allows the app to be standalone and use Puter's cloud storage.
 */

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  try {
    const key = relKey.replace(/^\/+/, "");
    // Puter.js storage.write handles buffers and strings
    await puter.kv.set(`file:${key}`, data);
    
    // For public URLs, Puter usually requires hosting or specific sharing.
    // In a standalone app, we can use Puter's KV or file system.
    // Here we'll simulate a URL or use a placeholder if direct public URL isn't available via KV.
    const url = `puter://kv/file:${key}`;
    
    return { key, url };
  } catch (error) {
    console.error("[Storage] Puter upload failed:", error);
    throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = relKey.replace(/^\/+/, "");
  return {
    key,
    url: `puter://kv/file:${key}`,
  };
}
