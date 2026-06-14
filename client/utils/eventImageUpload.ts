import heic2any from "heic2any";
import api, { staffAuthHeaders } from "@/lib/api";
import type { EventImageRole } from "@/constants/eventImageContexts";
import type { StaffFetchImageResponse } from "@shared/api";
import { isStaffProxyableImageUrl, normalizeCdnUploadUrl } from "@shared/cdnUrl";

const ROLE_MAX_WIDTH: Record<EventImageRole, number> = {
  hero: 1280,
  banner: 1600,
  sponsor: 1200,
  gallery: 1280,
};

const MAX_BYTES = 500 * 1024;
const OUTPUT_JPEG = "image/jpeg";

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

export async function normalizeImageUploadFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  const converted = await heic2any({
    blob: file,
    toType: OUTPUT_JPEG,
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
  return new File([blob], `${baseName}.jpg`, { type: OUTPUT_JPEG });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob_failed"))),
      mime,
      quality,
    );
  });
}

export async function prepareEventImageFile(
  file: File,
  role: EventImageRole = "hero",
): Promise<File> {
  const normalized = await normalizeImageUploadFile(file);
  if (!normalized.type.startsWith("image/")) {
    return normalized;
  }

  const preservePng = role === "sponsor" && normalized.type === "image/png";
  const outputMime = preservePng ? "image/png" : OUTPUT_JPEG;
  const maxWidth = ROLE_MAX_WIDTH[role];

  const bitmap = await createImageBitmap(normalized);
  const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return normalized;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  if (preservePng) {
    const blob = await canvasToBlob(canvas, outputMime);
    const baseName = normalized.name.replace(/\.[^.]+$/, "") || role;
    return new File([blob], `${baseName}.png`, { type: outputMime });
  }

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, outputMime, quality);
  while (blob.size > MAX_BYTES && quality > 0.5) {
    quality -= 0.06;
    blob = await canvasToBlob(canvas, outputMime, quality);
  }

  const baseName = normalized.name.replace(/\.[^.]+$/, "") || role;
  return new File([blob], `${baseName}.jpg`, { type: outputMime });
}

/** @deprecated Use prepareEventImageFile(file, "hero") */
export async function prepareEventHeroFile(file: File): Promise<File> {
  return prepareEventImageFile(file, "hero");
}

function blobToFile(blob: Blob, fallbackName: string): File {
  const ext = blob.type.includes("png") ? "png" : "jpg";
  return new File([blob], `${fallbackName}.${ext}`, { type: blob.type });
}

async function fetchBlobUrlAsFile(url: string, fallbackName: string): Promise<File | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return blobToFile(blob, fallbackName);
  } catch {
    return null;
  }
}

async function fetchImageViaStaffProxy(
  url: string,
  fallbackName: string,
  isAdmin: boolean,
): Promise<File | null> {
  const endpoint = isAdmin ? "/admin/events/fetch-image" : "/organizer/events/fetch-image";
  const { data } = await api.post<StaffFetchImageResponse>(
    endpoint,
    { url },
    { headers: staffAuthHeaders },
  );

  const binary = atob(data.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: data.mimeType || "image/jpeg" });
  if (!blob.type.startsWith("image/")) return null;
  return blobToFile(blob, fallbackName);
}

export async function fetchRemoteImageAsFile(
  url: string,
  fallbackName = "image",
  isAdmin = false,
): Promise<File | null> {
  const normalized = normalizeCdnUploadUrl(url) ?? url;

  if (normalized.startsWith("blob:")) {
    const file = await fetchBlobUrlAsFile(normalized, fallbackName);
    return file ? normalizeImageUploadFile(file) : null;
  }

  if (isStaffProxyableImageUrl(normalized)) {
    try {
      const file = await fetchImageViaStaffProxy(normalized, fallbackName, isAdmin);
      return file ? normalizeImageUploadFile(file) : null;
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(normalized);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return normalizeImageUploadFile(blobToFile(blob, fallbackName));
  } catch {
    return null;
  }
}
