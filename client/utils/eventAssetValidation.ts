import type { TFunction } from "i18next";
import { isGpxFile } from "@/utils/gpxParse";

export type EventAssetKind = "image" | "document" | "gpx";

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
const DOC_TYPES = ["application/pdf"];

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    type.includes("heic") ||
    type.includes("heif")
  );
}

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
    if (!IMAGE_TYPES.includes(file.type) && !isHeicFile(file)) {
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
    if (!isGpxFile(file)) {
      return t("staffPortal.eventEdit.assetValidation.gpxType");
    }
    return null;
  }
  return null;
}
