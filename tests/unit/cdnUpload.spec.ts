import { describe, it, expect } from "vitest";
import {
  buildCdnPublicUrl,
  normalizeCdnUploadUrl,
} from "../../server/cdnUpload.js";

describe("CDN public URL helpers", () => {
  it("builds upload URLs with /data/api prefix", () => {
    expect(
      buildCdnPublicUrl(
        "/data/triboo-sport/event_1_hero/main_image/abc_123.jpg",
      ),
    ).toBe(
      "https://disruptinglabs.com/data/api/data/triboo-sport/event_1_hero/main_image/abc_123.jpg",
    );
  });

  it("normalizes legacy upload URLs missing /data/api", () => {
    const legacy =
      "https://disruptinglabs.com/data/triboo-sport/event_hero_event_draft_1/main_image/abc.jpg";
    expect(normalizeCdnUploadUrl(legacy)).toBe(
      "https://disruptinglabs.com/data/api/data/triboo-sport/event_hero_event_draft_1/main_image/abc.jpg",
    );
  });

  it("leaves static marketing asset URLs unchanged", () => {
    const staticUrl =
      "https://disruptinglabs.com/data/triboo/assets/images/logos/logo.png";
    expect(normalizeCdnUploadUrl(staticUrl)).toBe(staticUrl);
  });

  it("leaves already-correct API URLs unchanged", () => {
    const correct =
      "https://disruptinglabs.com/data/api/data/triboo-sport/x/y/main_image/z.jpg";
    expect(normalizeCdnUploadUrl(correct)).toBe(correct);
  });
});
