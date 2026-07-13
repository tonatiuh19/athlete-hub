import { describe, expect, it } from "vitest";
import {
  canOrganizerRecordManualSale,
  canOrganizerViewAllPayments,
  canOrganizerViewPayments,
} from "@shared/staffRoles";

describe("staffRoles manual sales", () => {
  it("allows seller to record manual sales", () => {
    expect(canOrganizerRecordManualSale("seller")).toBe(true);
  });

  it("allows seller to view payments but not all-team view", () => {
    expect(canOrganizerViewPayments("seller")).toBe(true);
    expect(canOrganizerViewAllPayments("seller")).toBe(false);
  });

  it("allows owner to view all payments", () => {
    expect(canOrganizerViewAllPayments("owner")).toBe(true);
  });
});
