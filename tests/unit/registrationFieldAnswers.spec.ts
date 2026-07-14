import { describe, expect, it } from "vitest";
import { validateRegistrationFieldAnswers } from "../../shared/registrationFields";

describe("validateRegistrationFieldAnswers", () => {
  const fields = [
    {
      field_key: "club",
      label: "Club",
      field_type: "text",
      is_required: true,
    },
    {
      field_key: "notes",
      label: "Notes",
      field_type: "text",
      is_required: false,
    },
  ];

  it("returns null when required answers are present", () => {
    expect(validateRegistrationFieldAnswers(fields, { club: "Trail MX" })).toBeNull();
  });

  it("returns an error when a required field is missing", () => {
    expect(validateRegistrationFieldAnswers(fields, {})).toMatch(/Club/i);
  });
});
