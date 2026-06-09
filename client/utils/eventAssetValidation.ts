import type { TFunction } from "i18next";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOC_TYPES = ["application/pdf"];
const GPX_TYPES = ["application/gpx+xml", "application/xml", "text/xml"];

export type EventAssetKind = "image" | "document" | "gpx";

export function validateEventAssetFile(
  file: File,
  kind: EventAssetKind,
  t: TFunction,
): string | null {
  const maxMb = kind === "document" ? 12 : 8;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return t("staffPortal.eventEdit.assetValidation.size", { maxMb });
  }

  const name = file.name.toLowerCase();
  if (kind === "image") {
    if (!IMAGE_TYPES.includes(file.type)) {
      return t("staffPortal.eventEdit.assetValidation.imageType");
    }
    return null;
  }
  if (kind === "document") {
    if (!DOC_TYPES.includes(file.type) && !name.endsWith(".pdf")) {
      return t("staffPortal.eventEdit.assetValidation.pdfType");
    }
    return null;
  }
  if (kind === "gpx") {
    if (!GPX_TYPES.includes(file.type) && !name.endsWith(".gpx")) {
      return t("staffPortal.eventEdit.assetValidation.gpxType");
    }
    return null;
  }
  return null;
}
