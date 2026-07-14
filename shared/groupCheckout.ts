import type { CheckoutBreakdownSnapshot } from "./checkoutBreakdown.js";
import type { WaiverSignatureInput } from "./api.js";
import type { ResolvedExtraLine } from "./eventExtras.js";

export type GroupParticipantType = "self" | "account" | "guest";

export type GroupParticipantGender =
  | "male"
  | "female"
  | "other"
  | "prefer_not_to_say";

export interface GroupGuestParticipant {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  gender: GroupParticipantGender;
}

export interface GroupCheckoutLineItemInput {
  /** Client-generated id for wizard state */
  lineId: string;
  participantType: GroupParticipantType;
  /** For participantType account */
  accountEmail?: string;
  /** For participantType guest */
  guest?: GroupGuestParticipant;
  /** Parent/guardian relationship when participant is a minor */
  guardianRelationship?: string;
  /**
   * Force managed-by-purchaser (no claim email), even if adult.
   * Minors are always managed automatically.
   */
  managedByPurchaser?: boolean;
  categoryId: number;
  fieldValues: Record<string, string | boolean>;
  waiverSignatures?: WaiverSignatureInput[];
  selectedExtras?: Array<{ extraId: number; quantity: number }>;
  extraFieldAnswers?: Array<{
    extraId: number;
    values: Record<string, string | boolean | Record<string, unknown>>;
  }>;
  waitlistEntryId?: number;
}

export interface GroupCheckoutLineItemResolved
  extends Omit<GroupCheckoutLineItemInput, "selectedExtras"> {
  categoryName: string;
  categoryListPriceCents: number;
  extrasSubtotalCents: number;
  listPriceCents: number;
  serviceFeeCents: number;
  totalCents: number;
  breakdown: CheckoutBreakdownSnapshot;
  resolvedAthleteId?: number;
  participantLabel: string;
  participantEmail: string;
  selectedExtras?: ResolvedExtraLine[];
}

export interface GroupRegistrationCheckoutRequest {
  lineItems: GroupCheckoutLineItemInput[];
  idempotencyKey: string;
  discountCode?: string;
}

export interface GroupRegistrationOrderSummary {
  publicUuid: string;
  itemCount: number;
  subtotalCents: number;
  serviceFeeCents: number;
  discountAmountCents: number;
  totalCents: number;
  currency: string;
  lineItems: Array<{
    lineId: string;
    categoryName: string;
    participantLabel: string;
    participantEmail: string;
    totalCents: number;
  }>;
}

export interface GroupRegistrationConfirmRegistration {
  public_uuid: string;
  registration_number: string;
  qr_code_token: string;
  bib_number?: string | null;
  status: string;
  total_cents: number;
  category_name: string;
  participant_label: string;
  participant_email: string;
  guest_claim_token?: string | null;
  /** Purchaser should keep QR (minor / managed / unclaimed guest) */
  wallet_held_by_purchaser?: boolean;
  is_managed_participant?: boolean;
}

export const DEFAULT_MAX_REGISTRATIONS_PER_ORDER = 10;

export function normalizeParticipantEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isMinorOnReferenceDate(
  dateOfBirth: string,
  referenceDate: string,
  adultAge = 18,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ry, rm, rd] = referenceDate.split("-").map(Number);
  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) age -= 1;
  return age < adultAge;
}
