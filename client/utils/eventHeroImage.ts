/** Resize/compress event hero images before CDN upload for faster page loads. */

const MAX_HERO_WIDTH = 1600;
const MAX_HERO_BYTES = 900 * 1024;
const OUTPUT_MIME = "image/jpeg";

export async function prepareEventHeroFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_HERO_WIDTH / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.86;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_HERO_BYTES && quality > 0.5) {
    quality -= 0.06;
    blob = await canvasToBlob(canvas, quality);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "hero";
  return new File([blob], `${baseName}.jpg`, { type: OUTPUT_MIME });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob_failed"))),
      OUTPUT_MIME,
      quality,
    );
  });
}
