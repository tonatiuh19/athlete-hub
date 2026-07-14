import { describe, expect, it } from "vitest";
import {
  coreColumnIdsForPreset,
  extraFieldColumnId,
  extraQtyColumnId,
  formatCentsAsMxn,
  formatExtraAnswerValue,
  parseExportColumnId,
  rowsToCsv,
} from "../../shared/registrationExport";

describe("registrationExport column ids", () => {
  it("parses core, field, and extra column ids", () => {
    expect(parseExportColumnId("core.folio")).toEqual({ kind: "core", key: "folio" });
    expect(parseExportColumnId("field.42")).toEqual({ kind: "field", fieldId: 42 });
    expect(parseExportColumnId(extraQtyColumnId(7))).toEqual({ kind: "extra_qty", extraId: 7 });
    expect(parseExportColumnId(extraFieldColumnId(7, "size"))).toEqual({
      kind: "extra_field",
      extraId: 7,
      fieldKey: "size",
    });
    expect(parseExportColumnId("extra.bad")).toBeNull();
  });

  it("builds preset core columns", () => {
    const race = coreColumnIdsForPreset("race_day");
    expect(race).toContain("core.bib");
    expect(race).toContain("core.checked_in");
    expect(race).not.toContain("core.email");
  });

  it("formats money and extra answers", () => {
    expect(formatCentsAsMxn(2550)).toBe("25.50");
    expect(formatExtraAnswerValue("M", null)).toBe("M");
    expect(formatExtraAnswerValue(null, { street: "Av 1", cp: "01000" })).toBe(
      "street=Av 1; cp=01000",
    );
  });

  it("emits CSV with BOM for Excel", () => {
    const csv = rowsToCsv(["a", "b"], [["1", "hello, world"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"hello, world"');
  });
});
