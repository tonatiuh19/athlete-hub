import { describe, expect, it } from "vitest";
import {
  buildEventMediaSrcSet,
  isStaffProxyableImageUrl,
  normalizeCdnUploadUrl,
  optimizeEventMediaUrl,
} from "@shared/cdnUrl";

describe("optimizeEventMediaUrl", () => {
  it("downsizes Unsplash URLs for card display", () => {
    const url =
      "https://images.unsplash.com/photo-1452626212852-811d58933cae?w=1200&q=80";
    const optimized = optimizeEventMediaUrl(url, "card");
    expect(optimized).toContain("w=480");
    expect(optimized).toContain("q=72");
    expect(optimized).toContain("auto=format");
  });

  it("leaves CDN URLs unchanged", () => {
    const url =
      "https://disruptinglabs.com/data/api/data/triboo-sport/event_1/main_image/hero.jpg";
    expect(optimizeEventMediaUrl(url, "card")).toBe(normalizeCdnUploadUrl(url));
  });

  it("builds srcset for Unsplash", () => {
    const url = "https://images.unsplash.com/photo-abc123?w=1200";
    const srcSet = buildEventMediaSrcSet(url, "card");
    expect(srcSet).toContain("480w");
    expect(srcSet).toContain("960w");
  });
});

describe("isStaffProxyableImageUrl", () => {
  it("allows triboo CDN upload URLs", () => {
    const url =
      "https://disruptinglabs.com/data/triboo-sport/event_1_hero/main_image/photo.jpg";
    expect(isStaffProxyableImageUrl(url)).toBe(true);
    expect(isStaffProxyableImageUrl(normalizeCdnUploadUrl(url)!)).toBe(true);
  });

  it("allows static triboo marketing assets", () => {
    expect(
      isStaffProxyableImageUrl(
        "https://disruptinglabs.com/data/triboo/assets/hero.jpg",
      ),
    ).toBe(true);
  });

  it("rejects non-CDN hosts", () => {
    expect(isStaffProxyableImageUrl("https://example.com/data/photo.jpg")).toBe(false);
  });

  it("rejects non-https URLs", () => {
    expect(
      isStaffProxyableImageUrl("http://disruptinglabs.com/data/triboo/assets/x.jpg"),
    ).toBe(false);
  });
});
