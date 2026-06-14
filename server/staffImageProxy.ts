import type { Request, Response } from "express";
import { isStaffProxyableImageUrl, normalizeCdnUploadUrl } from "../shared/cdnUrl.js";

const ALLOWED_IMAGE_MIME = /^image\/(jpeg|png|webp|gif|heic|heif)$/i;
const MAX_PROXY_BYTES = 12 * 1024 * 1024;

export async function fetchStaffProxyImage(
  url: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const normalized = normalizeCdnUploadUrl(url.trim()) ?? url.trim();
  if (!isStaffProxyableImageUrl(normalized)) {
    throw new Error("URL not allowed");
  }

  const upstream = await fetch(normalized, { redirect: "follow" });
  if (!upstream.ok) {
    throw new Error(`Upstream HTTP ${upstream.status}`);
  }

  const mimeType =
    upstream.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
    "image/jpeg";
  if (!ALLOWED_IMAGE_MIME.test(mimeType)) {
    throw new Error("Not an image");
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Empty image");
  }
  if (buffer.length > MAX_PROXY_BYTES) {
    throw new Error("Image too large");
  }

  return { buffer, mimeType };
}

export async function handleStaffImageProxy(req: Request, res: Response): Promise<void> {
  const url = String(req.body?.url ?? "").trim();
  if (!url) {
    res.status(400).json({ error: "url required" });
    return;
  }

  try {
    const { buffer, mimeType } = await fetchStaffProxyImage(url);
    res.json({
      dataBase64: buffer.toString("base64"),
      mimeType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    res.status(400).json({ error: message });
  }
}
