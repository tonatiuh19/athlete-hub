import type { Request, Response } from "express";
import { uploadImageBufferToCdn } from "./cdnUpload.js";

const IMAGE_MIMES = /^image\/(jpeg|png|webp|gif)$/i;
const PDF_MIME = /^application\/pdf$/i;
const GPX_MIME = /^(application\/gpx\+xml|application\/xml|text\/xml)$/i;

export async function handleEventAssetUpload(req: Request, res: Response): Promise<void> {
  const dataBase64 = String(req.body?.dataBase64 ?? "");
  const filename = String(req.body?.filename ?? "asset.bin").slice(0, 200);
  const mimeType = String(req.body?.mimeType ?? "application/octet-stream");
  const uploadId = String(req.body?.uploadId ?? "event_temp").slice(0, 120);
  const assetKind = String(req.body?.assetKind ?? "image").slice(0, 40);

  if (!dataBase64) {
    res.status(400).json({ error: "dataBase64 required" });
    return;
  }

  const allowed =
    IMAGE_MIMES.test(mimeType) ||
    PDF_MIME.test(mimeType) ||
    GPX_MIME.test(mimeType) ||
    filename.toLowerCase().endsWith(".gpx");

  if (!allowed) {
    res.status(400).json({ error: "Unsupported file type" });
    return;
  }

  const buffer = Buffer.from(dataBase64, "base64");
  const maxMb = PDF_MIME.test(mimeType) || filename.endsWith(".pdf") ? 12 : 8;
  if (buffer.length > maxMb * 1024 * 1024) {
    res.status(400).json({ error: `File exceeds ${maxMb}MB limit` });
    return;
  }

  try {
    const uploadMime = IMAGE_MIMES.test(mimeType)
      ? mimeType
      : filename.toLowerCase().endsWith(".gpx")
        ? "application/gpx+xml"
        : "application/pdf";

    const result = await uploadImageBufferToCdn({
      buffer,
      filename,
      mimeType: uploadMime,
      uploadId: `event_${assetKind}_${uploadId}`,
    });
    res.json({ ok: true, url: result.url, path: result.path });
  } catch (err) {
    console.error("[event:upload-asset]", err);
    res.status(502).json({ error: "CDN upload failed" });
  }
}
