/**
 * Image uploads → Disrupting Labs CDN (uploadImages.php).
 * Public file URLs must use the /data/api prefix (see enteratelo-php + real-state).
 */

import { normalizeCdnUploadUrl as normalizeCdnUploadUrlShared } from "../shared/cdnUrl.js";

const CDN_UPLOAD_URL =
  "https://disruptinglabs.com/data/api/uploadImages.php";

/** Base for uploaded files served from PHP data directory (not SPA static assets). */
export const CDN_UPLOAD_PUBLIC_BASE = "https://disruptinglabs.com/data/api";

const TRIBOO_CDN_FOLDER = "triboo-sport";

export function buildCdnPublicUrl(relativePath: string): string {
  if (relativePath.startsWith("http")) {
    return normalizeCdnUploadUrl(relativePath);
  }
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${CDN_UPLOAD_PUBLIC_BASE}${path}`;
}

/**
 * Fix legacy URLs that omitted /data/api (Apache returned SPA HTML → broken <img>).
 * Static marketing assets (e.g. triboo/assets) are left unchanged.
 */
export function normalizeCdnUploadUrl(url: string): string;
export function normalizeCdnUploadUrl(url: string | null | undefined): string | null;
export function normalizeCdnUploadUrl(url: string | null | undefined): string | null {
  return normalizeCdnUploadUrlShared(url);
}

export async function uploadImageBufferToCdn(opts: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  uploadId: string;
  folder?: string;
}): Promise<{ url: string; path: string; filename: string }> {
  const folder = opts.folder ?? TRIBOO_CDN_FOLDER;
  const safeId = opts.uploadId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || "temp";

  const form = new FormData();
  form.append("main_folder", folder);
  form.append("id", safeId);
  form.append(
    "main_image",
    new Blob([new Uint8Array(opts.buffer)], { type: opts.mimeType }),
    opts.filename,
  );

  const res = await fetch(CDN_UPLOAD_URL, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`CDN upload failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    success?: boolean;
    main_image?: { path?: string; filename?: string };
    error?: string;
    errors?: Array<{ error?: string }>;
  };

  if (!data.success || !data.main_image?.path) {
    const detail =
      data.error ||
      data.errors?.[0]?.error ||
      "CDN returned no image path";
    throw new Error(detail);
  }

  return {
    path: data.main_image.path,
    filename: data.main_image.filename ?? opts.filename,
    url: buildCdnPublicUrl(data.main_image.path),
  };
}
