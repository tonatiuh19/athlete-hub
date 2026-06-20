export type StripeConnectStatus =
  | "not_started"
  | "pending"
  | "action_required"
  | "ready"
  | "restricted"
  | "disabled";

export type StripeConnectOnboardingMode = "self" | "admin";

export type { FeePresentation } from "./checkoutBreakdown.js";
import type { FeePresentation } from "./checkoutBreakdown.js";

export interface OrganizerPayoutProfileInput {
  legal_name?: string | null;
  billing_email?: string | null;
  rfc?: string | null;
  tax_regime?: string | null;
  payout_terms_accepted_at?: string | Date | null;
  payout_fee_acknowledged_at?: string | Date | null;
}

export interface OrganizerConnectState extends OrganizerPayoutProfileInput {
  organizer_id: number;
  email: string;
  service_fee_percent: number;
  fee_presentation: FeePresentation;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean | number;
  stripe_connect_status: StripeConnectStatus;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_connect_onboarded_at?: string | null;
  stripe_connect_last_synced_at?: string | null;
  stripe_connect_onboarding_mode?: StripeConnectOnboardingMode | null;
  requirements_currently_due?: string[];
  requirements_eventually_due?: string[];
  requirements_disabled_reason?: string | null;
}

export interface TribooPayoutChecklistItem {
  key: string;
  complete: boolean;
  required: boolean;
}

export interface TribooPayoutChecklist {
  items: TribooPayoutChecklistItem[];
  complete: boolean;
}

export interface StripePayoutChecklist {
  items: TribooPayoutChecklistItem[];
  complete: boolean;
}

export function buildTribooPayoutChecklist(
  profile: OrganizerPayoutProfileInput,
): TribooPayoutChecklist {
  const items: TribooPayoutChecklistItem[] = [
    {
      key: "legal_name",
      complete: Boolean(profile.legal_name?.trim()),
      required: true,
    },
    {
      key: "rfc",
      complete: Boolean(profile.rfc?.trim()),
      required: true,
    },
    {
      key: "billing_email",
      complete: Boolean(profile.billing_email?.trim()),
      required: true,
    },
    {
      key: "payout_terms",
      complete: Boolean(profile.payout_terms_accepted_at),
      required: true,
    },
    {
      key: "fee_acknowledged",
      complete: Boolean(profile.payout_fee_acknowledged_at),
      required: true,
    },
  ];
  return {
    items,
    complete: items.filter((i) => i.required).every((i) => i.complete),
  };
}

export function buildStripePayoutChecklist(state: {
  stripe_account_id?: string | null;
  stripe_details_submitted: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  requirements_currently_due?: string[];
  requirements_eventually_due?: string[];
}): StripePayoutChecklist {
  const due = state.requirements_currently_due ?? [];
  const eventuallyDue = state.requirements_eventually_due ?? [];
  const hasAccount = Boolean(state.stripe_account_id);
  const items: TribooPayoutChecklistItem[] = [
    {
      key: "account_created",
      complete: hasAccount,
      required: true,
    },
    {
      key: "business_details",
      complete: state.stripe_details_submitted,
      required: true,
    },
    {
      key: "identity",
      complete: hasAccount && !due.some((d) => d.includes("verification")),
      required: true,
    },
    {
      key: "bank_account",
      complete: hasAccount && !due.some((d) => d.includes("external_account")),
      required: true,
    },
    {
      key: "charges_enabled",
      complete: state.stripe_charges_enabled,
      required: true,
    },
    {
      key: "payouts_enabled",
      complete: state.stripe_payouts_enabled,
      required: true,
    },
    {
      key: "future_requirements",
      complete: eventuallyDue.length === 0,
      required: false,
    },
  ];
  return {
    items,
    complete:
      hasAccount &&
      state.stripe_charges_enabled &&
      state.stripe_payouts_enabled &&
      due.length === 0,
  };
}

export function isTribooPayoutProfileComplete(profile: OrganizerPayoutProfileInput): boolean {
  return buildTribooPayoutChecklist(profile).complete;
}

export function isOrganizerPayoutReady(state: {
  stripe_connect_status: StripeConnectStatus;
  stripe_account_id?: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  requirements_currently_due?: string[];
  triboo_profile_complete: boolean;
}): boolean {
  if (!state.triboo_profile_complete) return false;
  if (state.stripe_connect_status !== "ready") return false;
  if (!state.stripe_account_id) return false;
  if (!state.stripe_charges_enabled || !state.stripe_payouts_enabled) return false;
  if ((state.requirements_currently_due?.length ?? 0) > 0) return false;
  return true;
}

export function deriveStripeConnectStatusFromCapabilities(opts: {
  disabled: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  currently_due: string[];
  disabled_reason?: string | null;
  has_account: boolean;
}): StripeConnectStatus {
  if (opts.disabled) return "disabled";
  if (!opts.has_account) return "not_started";
  if (opts.disabled_reason) return "restricted";
  if (opts.charges_enabled && opts.payouts_enabled && opts.currently_due.length === 0) {
    return "ready";
  }
  if (opts.details_submitted || opts.currently_due.length > 0) return "action_required";
  return "pending";
}
