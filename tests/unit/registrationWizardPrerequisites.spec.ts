/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import type { EventRegistrationField, WaiverSignatureInput } from "@shared/api";
import {
  hasMissingRequiredRegistrationFields,
  prerequisiteGapFromCheckoutError,
  prerequisiteGapToWizardStep,
  resolveFirstIncompleteRegistrationStep,
} from "../../client/utils/registrationWizardPrerequisites";

const phoneField = {
  id: 1,
  field_key: "telefono",
  label: "Teléfono",
  field_type: "text",
  is_required: true,
  sort_order: 0,
  is_active: true,
  scope_type: "all_categories",
} as EventRegistrationField;

const optionalField = {
  id: 2,
  field_key: "club",
  label: "Club",
  field_type: "text",
  is_required: false,
  sort_order: 1,
  is_active: true,
  scope_type: "all_categories",
} as EventRegistrationField;

const waiverSig: WaiverSignatureInput[] = [
  { waiverId: 9, signature: "accepted", waiverVersion: 1 },
];

describe("registrationWizardPrerequisites", () => {
  it("sends unauthenticated athletes to auth first", () => {
    expect(
      resolveFirstIncompleteRegistrationStep({
        isAuthenticated: false,
        needsWaiver: true,
        waiverAcceptance: waiverSig,
        hasExtras: false,
        registrationFields: [phoneField],
        fieldValues: { telefono: "555" },
      }),
    ).toBe("auth");
  });

  it("requires waiver before fields/checkout when event needs it", () => {
    expect(
      resolveFirstIncompleteRegistrationStep({
        isAuthenticated: true,
        needsWaiver: true,
        waiverAcceptance: null,
        hasExtras: false,
        registrationFields: [phoneField],
        fieldValues: { telefono: "555" },
      }),
    ).toBe("waiver");
  });

  it("requires missing campos extra before payment", () => {
    expect(
      resolveFirstIncompleteRegistrationStep({
        isAuthenticated: true,
        needsWaiver: true,
        waiverAcceptance: waiverSig,
        hasExtras: false,
        registrationFields: [phoneField, optionalField],
        fieldValues: { club: "Triboo" },
      }),
    ).toBe("fields");
  });

  it("allows checkout when auth, waiver, and required fields are complete", () => {
    expect(
      resolveFirstIncompleteRegistrationStep({
        isAuthenticated: true,
        needsWaiver: true,
        waiverAcceptance: waiverSig,
        hasExtras: false,
        registrationFields: [phoneField, optionalField],
        fieldValues: { telefono: "5551234567" },
      }),
    ).toBe("checkout");
  });

  it("skips waiver gap when event does not require one", () => {
    expect(
      resolveFirstIncompleteRegistrationStep({
        isAuthenticated: true,
        needsWaiver: false,
        waiverAcceptance: null,
        hasExtras: false,
        registrationFields: [],
        fieldValues: {},
      }),
    ).toBe("checkout");
  });

  it("treats unchecked required checkbox as missing", () => {
    const checkbox = {
      ...phoneField,
      id: 3,
      field_key: "acepto_reglamento",
      field_type: "checkbox",
    } as EventRegistrationField;
    expect(
      hasMissingRequiredRegistrationFields([checkbox], {
        acepto_reglamento: false,
      }),
    ).toBe(true);
    expect(
      hasMissingRequiredRegistrationFields([checkbox], { acepto_reglamento: true }),
    ).toBe(false);
  });

  it("maps API waiver errors back to the waiver step", () => {
    expect(prerequisiteGapFromCheckoutError("Waiver acceptance required")).toBe(
      "waiver",
    );
    expect(prerequisiteGapToWizardStep("waiver")).toBe("waiver");
    expect(prerequisiteGapToWizardStep("fields")).toBe("checkout");
  });
});
