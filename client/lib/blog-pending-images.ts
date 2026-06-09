import { uploadBlogImageToCdn } from "@/lib/cdn-upload";

export function createBlobPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeBlobUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function revokeAllBlobUrls(urls: Iterable<string>): void {
  for (const url of urls) {
    revokeBlobUrl(url);
  }
}

/** Upload staged files only when saving the post (avoids orphan CDN files). */
export async function uploadPendingBlogImages(opts: {
  coverPendingFile: File | null;
  coverSavedUrl: string | null;
  bodyHtml: string;
  bodyPendingByUrl: Map<string, File>;
  uploadId: string;
  isAdmin: boolean;
}): Promise<{ coverImageUrl: string | null; bodyHtml: string }> {
  const {
    coverPendingFile,
    coverSavedUrl,
    bodyHtml,
    bodyPendingByUrl,
    uploadId,
    isAdmin,
  } = opts;

  let coverImageUrl = coverSavedUrl;
  if (coverPendingFile) {
    coverImageUrl = await uploadBlogImageToCdn(coverPendingFile, uploadId, isAdmin);
  }

  let resolvedBody = bodyHtml;
  if (bodyPendingByUrl.size > 0) {
    resolvedBody = await uploadPendingHtmlImages({
      html: bodyHtml,
      pendingByUrl: bodyPendingByUrl,
      uploadId,
      isAdmin,
    });
  }

  return { coverImageUrl, bodyHtml: resolvedBody };
}

/** Replace blob: URLs in rich HTML with CDN URLs on save. */
export async function uploadPendingHtmlImages(opts: {
  html: string;
  pendingByUrl: Map<string, File>;
  uploadId: string;
  isAdmin: boolean;
}): Promise<string> {
  let resolved = opts.html;
  let index = 0;
  for (const [blobUrl, file] of opts.pendingByUrl.entries()) {
    if (!resolved.includes(blobUrl)) continue;
    const cdnUrl = await uploadBlogImageToCdn(
      file,
      `${opts.uploadId}_img_${index++}`,
      opts.isAdmin,
    );
    resolved = resolved.split(blobUrl).join(cdnUrl);
  }
  return resolved;
}
