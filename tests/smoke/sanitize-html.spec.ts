// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

describe("smoke: HTML sanitization (convocatoria / waivers)", () => {
  it("allows safe rich content", () => {
    const out = sanitizeHtml('<p>Hello</p><a href="https://example.com">Link</a>');
    expect(out).toContain("<p>Hello</p>");
    expect(out).toContain('href="https://example.com"');
  });

  it("strips script tags and event handlers", () => {
    const out = sanitizeHtml('<p onclick="alert(1)">X</p><script>alert("xss")</script>');
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("onclick");
  });

  it("returns empty string for blank input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml("   ")).toBe("");
  });
});
