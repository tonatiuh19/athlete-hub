import { describe, it, expect } from "vitest";
import {
  eventDescriptionHasContent,
  eventDescriptionIsHtml,
  eventDescriptionPlainParagraphs,
  eventDescriptionPlainText,
} from "@/utils/eventDescriptionHtml";

describe("smoke: convocatoria / event description content", () => {
  it("detects TipTap HTML vs legacy plain text", () => {
    expect(eventDescriptionIsHtml("<p>Hello <strong>world</strong></p>")).toBe(true);
    expect(eventDescriptionIsHtml("Plain text\nwith lines")).toBe(false);
  });

  it("treats empty TipTap HTML as no content", () => {
    expect(eventDescriptionHasContent("<p></p>")).toBe(false);
    expect(eventDescriptionHasContent("<p><br></p>")).toBe(false);
    expect(eventDescriptionHasContent("<p>&nbsp;</p>")).toBe(false);
    expect(eventDescriptionHasContent("<p>Real content</p>")).toBe(true);
  });

  it("strips HTML for meta descriptions and JSON-LD", () => {
    const plain = eventDescriptionPlainText(
      "<h2>Convocatoria</h2><p>Start time <strong>7:00 AM</strong>.</p>",
    );
    expect(plain).toContain("Convocatoria");
    expect(plain).toContain("7:00 AM");
    expect(plain).not.toContain("<");
  });

  it("splits legacy plain text into paragraphs", () => {
    expect(eventDescriptionPlainParagraphs("Line one\n\nLine two")).toEqual([
      "Line one",
      "Line two",
    ]);
  });
});
