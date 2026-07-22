import type {
  EventRegistrationField,
  WaiverSignatureInput,
} from "@shared/api";
import type { RegistrationWizardStep } from "@/store/slices/registrationCheckoutSlice";
import { normalizeRegistrationField } from "@shared/registrationFields";

export type RegistrationPrerequisiteGap =
  | "auth"
  | "waiver"
  | "extras"
  | "fields"
  | "checkout";

/**
 * First incomplete step in the solo registration wizard.
 * Used on retry and when checkout fails for a missing prerequisite.
 */
export function resolveFirstIncompleteRegistrationStep(opts: {
  isAuthenticated: boolean;
  needsWaiver: boolean;
  waiverAcceptance: WaiverSignatureInput[] | null | undefined;
  hasExtras: boolean;
  extrasCompleted?: boolean;
  registrationFields: EventRegistrationField[];
  fieldValues?: Record<string, string | boolean> | null;
}): RegistrationPrerequisiteGap {
  if (!opts.isAuthenticated) return "auth";

  if (opts.needsWaiver) {
    const accepted = (opts.waiverAcceptance?.length ?? 0) > 0;
    if (!accepted) return "waiver";
  }

  if (opts.hasExtras && opts.extrasCompleted === false) {
    return "extras";
  }

  if (hasMissingRequiredRegistrationFields(opts.registrationFields, opts.fieldValues)) {
    return "fields";
  }

  return "checkout";
}

export function hasMissingRequiredRegistrationFields(
  fields: EventRegistrationField[],
  fieldValues?: Record<string, string | boolean> | null,
): boolean {
  const values = fieldValues ?? {};
  for (const raw of fields) {
    const field = normalizeRegistrationField(raw);
    if (!field.is_required) continue;
    if (field.field_type === "file") continue;
    if (field.field_type === "checkbox") {
      if (values[field.field_key] !== true && values[field.field_key] !== "true") {
        return true;
      }
      continue;
    }
    const v = values[field.field_key];
    if (v == null || String(v).trim() === "") return true;
  }
  return false;
}

export function prerequisiteGapToWizardStep(
  gap: RegistrationPrerequisiteGap,
): RegistrationWizardStep {
  switch (gap) {
    case "auth":
      return "auth";
    case "waiver":
      return "waiver";
    case "extras":
      return "extras";
    case "fields":
    case "checkout":
      return "checkout";
  }
}

/** Map API / client error text to a prerequisite gap when possible. */
export function prerequisiteGapFromCheckoutError(
  error: string | null | undefined,
): RegistrationPrerequisiteGap | null {
  if (!error) return null;
  const lower = error.toLowerCase();
  if (lower.includes("waiver")) return "waiver";
  if (
    lower.includes("required") &&
    (lower.includes("field") || lower.includes("información") || lower.includes("information"))
  ) {
    return "fields";
  }
  return null;
}
