import { describe, expect, it } from "vitest";
import { cropAreaToImageStyle } from "@/utils/cropPreviewStyle";

describe("cropAreaToImageStyle", () => {
  it("maps a centered quarter crop to scaled image offsets", () => {
    const style = cropAreaToImageStyle({ x: 25, y: 25, width: 50, height: 50 });
    expect(style.left).toBe("-50%");
    expect(style.top).toBe("-50%");
    expect(style.width).toBe("200%");
    expect(style.height).toBe("200%");
  });
});
