import { describe, expect, it } from "vitest";
import { isStaffProxyableImageUrl } from "@shared/cdnUrl";
import { fetchStaffProxyImage } from "../../server/staffImageProxy";

describe("fetchStaffProxyImage", () => {
  it("rejects disallowed URLs", async () => {
    await expect(fetchStaffProxyImage("https://evil.example/photo.jpg")).rejects.toThrow(
      "URL not allowed",
    );
  });

  it("rejects malformed URLs", async () => {
    await expect(fetchStaffProxyImage("not-a-url")).rejects.toThrow("URL not allowed");
  });

  it("accepts only staff-proxyable CDN URLs at validation layer", () => {
    expect(
      isStaffProxyableImageUrl(
        "https://disruptinglabs.com/data/triboo-sport/event_1/main_image/x.jpg",
      ),
    ).toBe(true);
  });
});
