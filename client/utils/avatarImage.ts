const MAX_AVATAR_BYTES = 180 * 1024;
const MAX_DIMENSION = 256;

export async function prepareAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("invalid_type");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.88;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_AVATAR_BYTES * 1.37 && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  const base64Length = dataUrl.split(",")[1]?.length ?? 0;
  const approxBytes = Math.ceil((base64Length * 3) / 4);
  if (approxBytes > MAX_AVATAR_BYTES) {
    throw new Error("too_large");
  }

  return dataUrl;
}
