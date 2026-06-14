export type PayoutProfileForm = {
  legal_name: string;
  billing_email: string;
  rfc: string;
  tax_regime: string;
};

export type PayoutProfileFieldErrors = Partial<
  Record<keyof PayoutProfileForm, string>
>;

export function validatePayoutProfileForm(
  values: PayoutProfileForm,
  messages: {
    legalNameRequired: string;
    billingEmailInvalid: string;
    rfcInvalid: string;
  },
): PayoutProfileFieldErrors {
  const errors: PayoutProfileFieldErrors = {};
  if (!values.legal_name.trim()) {
    errors.legal_name = messages.legalNameRequired;
  }
  const email = values.billing_email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.billing_email = messages.billingEmailInvalid;
  }
  const rfc = values.rfc.trim().toUpperCase();
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
    errors.rfc = messages.rfcInvalid;
  }
  return errors;
}
