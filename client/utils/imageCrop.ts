import type { Area } from "react-easy-crop";

const HERO_MAX_WIDTH = 1280;
const BANNER_MAX_WIDTH = 1600;
const SPONSOR_MAX_WIDTH = 1200;
const GALLERY_MAX_WIDTH = 1280;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });
}

function pickOutputMime(sourceType?: string, role?: string): { mime: string; ext: string } {
  if (role === "sponsor" && sourceType === "image/png") {
    return { mime: "image/png", ext: "png" };
  }
  return { mime: "image/jpeg", ext: "jpg" };
}

function maxWidthForRole(role?: string): number {
  if (role === "banner") return BANNER_MAX_WIDTH;
  if (role === "sponsor") return SPONSOR_MAX_WIDTH;
  if (role === "gallery") return GALLERY_MAX_WIDTH;
  return HERO_MAX_WIDTH;
}

export async function cropImageToBlob(
  imageSrc: string,
  pixelCrop: Area,
  options?: {
    role?: string;
    sourceType?: string;
    maxWidth?: number;
    quality?: number;
  },
): Promise<{ blob: Blob; mime: string; ext: string }> {
  const image = await loadImage(imageSrc);
  const { mime, ext } = pickOutputMime(options?.sourceType, options?.role);
  const maxWidth = options?.maxWidth ?? maxWidthForRole(options?.role);
  const scale = Math.min(1, maxWidth / pixelCrop.width);
  const width = Math.max(1, Math.round(pixelCrop.width * scale));
  const height = Math.max(1, Math.round(pixelCrop.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not supported");
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height,
  );

  const quality = options?.quality ?? (mime === "image/jpeg" ? 0.9 : undefined);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Crop failed"))),
      mime,
      quality,
    );
  });

  return { blob, mime, ext };
}

export async function cropImageToFile(
  imageSrc: string,
  pixelCrop: Area,
  originalName: string,
  options?: {
    role?: string;
    sourceType?: string;
  },
): Promise<File> {
  const { blob, mime, ext } = await cropImageToBlob(imageSrc, pixelCrop, options);
  const baseName = originalName.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}-cropped.${ext}`, { type: mime });
}

export async function cropImageToPreviewUrl(
  imageSrc: string,
  pixelCrop: Area,
  options?: { role?: string; sourceType?: string; maxWidth?: number },
): Promise<string> {
  const { blob } = await cropImageToBlob(imageSrc, pixelCrop, {
    ...options,
    maxWidth: options?.maxWidth ?? 640,
    quality: 0.82,
  });
  return URL.createObjectURL(blob);
}
