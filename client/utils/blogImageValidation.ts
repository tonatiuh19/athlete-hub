const MAX_BLOG_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateBlogImageFile(
  file: File,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return t("staffPortal.blog.validation.imageType");
  }
  if (file.size > MAX_BLOG_IMAGE_BYTES) {
    return t("staffPortal.blog.validation.imageSize", { maxMb: 8 });
  }
  return null;
}
