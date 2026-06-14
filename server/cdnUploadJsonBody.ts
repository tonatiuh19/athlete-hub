import express, { type NextFunction, type Request, type Response } from "express";

/** Max decoded asset 12MB PDF; base64 adds ~33% plus JSON fields. */
export const CDN_UPLOAD_JSON_BODY_LIMIT = "20mb";

const CDN_UPLOAD_JSON_PATHS = new Set([
  "/api/admin/events/upload-asset",
  "/api/organizer/events/upload-asset",
  "/api/admin/blog/upload-image",
  "/api/organizer/blog/upload-image",
]);

const defaultJsonParser = express.json();
const cdnUploadJsonParser = express.json({ limit: CDN_UPLOAD_JSON_BODY_LIMIT });

/** Route-aware JSON parser: CDN base64 uploads need a higher limit than the default 100kb. */
export function cdnAwareJsonBodyParser(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method === "POST" && CDN_UPLOAD_JSON_PATHS.has(req.path)) {
    cdnUploadJsonParser(req, res, next);
    return;
  }
  defaultJsonParser(req, res, next);
}
