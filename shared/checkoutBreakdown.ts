/** Platform default service fee % (IVA included in displayed amounts). */
export const DEFAULT_SERVICE_FEE_PERCENT = 11;

/** Mexican IVA rate for informative sub-breakdown only. */
export const MX_IVA_RATE = 0.16;

export type FeePresentation = "pass_through" | "absorb_all";

export type DiscountAppliesTo = "registration" | "service_fee" | "total";

export function isValidFeePresentation(value: unknown): value is FeePresentation {
  return value === "pass_through" || value === "absorb_all";
}

export function resolveFeePresentation(
  eventPresentation?: string | null,
  organizerPresentation?: string | null,
): FeePresentation {
  if (isValidFeePresentation(eventPresentation)) return eventPresentation;
  if (isValidFeePresentation(organizerPresentation)) return organizerPresentation;
  return "pass_through";
}

export function calcServiceFeeCents(priceCents: number, feePercent: number): number {
  if (priceCents <= 0 || feePercent <= 0) return 0;
  return Math.round(priceCents * (feePercent / 100));
}

export function calcDisplayIvaCents(grossCents: number): number {
  if (grossCents <= 0) return 0;
  return Math.round(grossCents * MX_IVA_RATE);
}

export function resolveServiceFeePercent(
  eventFee?: number | string | null,
  organizerFee?: number | string | null,
): number {
  const eventNum = eventFee != null && eventFee !== "" ? Number(eventFee) : NaN;
  if (Number.isFinite(eventNum) && eventNum >= 0) return eventNum;
  const orgNum = organizerFee != null && organizerFee !== "" ? Number(organizerFee) : NaN;
  if (Number.isFinite(orgNum) && orgNum >= 0) return orgNum;
  return DEFAULT_SERVICE_FEE_PERCENT;
}

export interface CheckoutBreakdown {
  mode: FeePresentation;
  /** Category list price — inscription (pass_through) or public sticker (absorb_all). */
  listPriceCents: number;
  serviceFeePercent: number;
  serviceFeeCents: number;
  /** Informative IVA slice(s) for calculator / invoice preview. */
  displayIvaCents: number;
  athleteTotalCents: number;
  /** Organizer economic net after fee + display IVA slice (absorb_all). */
  organizerFiscalNetCents: number;
  /** Stripe transfer to organizer Connect account. */
  stripeOrganizerTransferCents: number;
  stripePlatformFeeCents: number;
  /** CFDI gross amounts (Facturama). */
  organizerCfdiGrossCents: number;
  platformCfdiGrossCents: number;
  /** @deprecated Use listPriceCents */
  inscriptionCents: number;
  /** @deprecated Use athleteTotalCents */
  totalCents: number;
  /** @deprecated Use stripeOrganizerTransferCents (pass_through) or organizerFiscalNetCents (absorb UI) */
  organizerReceivesCents: number;
  /** @deprecated Use stripePlatformFeeCents */
  platformFeeCents: number;
  inscriptionBaseCents: number;
  inscriptionIvaCents: number;
  serviceFeeBaseCents: number;
  serviceFeeIvaCents: number;
}

export interface CheckoutBreakdownSnapshot {
  mode: FeePresentation;
  listPriceCents: number;
  serviceFeePercent: number;
  serviceFeeCents: number;
  displayIvaCents: number;
  athleteTotalCents: number;
  organizerFiscalNetCents: number;
  stripeOrganizerTransferCents: number;
  stripePlatformFeeCents: number;
  organizerCfdiGrossCents: number;
  platformCfdiGrossCents: number;
}

export function breakdownToSnapshot(b: CheckoutBreakdown): CheckoutBreakdownSnapshot {
  return {
    mode: b.mode,
    listPriceCents: b.listPriceCents,
    serviceFeePercent: b.serviceFeePercent,
    serviceFeeCents: b.serviceFeeCents,
    displayIvaCents: b.displayIvaCents,
    athleteTotalCents: b.athleteTotalCents,
    organizerFiscalNetCents: b.organizerFiscalNetCents,
    stripeOrganizerTransferCents: b.stripeOrganizerTransferCents,
    stripePlatformFeeCents: b.stripePlatformFeeCents,
    organizerCfdiGrossCents: b.organizerCfdiGrossCents,
    platformCfdiGrossCents: b.platformCfdiGrossCents,
  };
}

function ivaPartsFromGrossCents(grossCents: number): { baseCents: number; ivaCents: number } {
  if (grossCents <= 0) return { baseCents: 0, ivaCents: 0 };
  const baseCents = Math.round(grossCents / (1 + MX_IVA_RATE));
  return { baseCents, ivaCents: grossCents - baseCents };
}

function attachLegacyFields(
  partial: Omit<
    CheckoutBreakdown,
    | "inscriptionCents"
    | "totalCents"
    | "organizerReceivesCents"
    | "platformFeeCents"
    | "inscriptionBaseCents"
    | "inscriptionIvaCents"
    | "serviceFeeBaseCents"
    | "serviceFeeIvaCents"
  >,
): CheckoutBreakdown {
  const inscriptionIva = ivaPartsFromGrossCents(partial.organizerCfdiGrossCents);
  const feeIva = ivaPartsFromGrossCents(partial.platformCfdiGrossCents);
  return {
    ...partial,
    inscriptionCents: partial.listPriceCents,
    totalCents: partial.athleteTotalCents,
    organizerReceivesCents:
      partial.mode === "absorb_all"
        ? partial.organizerFiscalNetCents
        : partial.stripeOrganizerTransferCents,
    platformFeeCents: partial.stripePlatformFeeCents,
    inscriptionBaseCents: inscriptionIva.baseCents,
    inscriptionIvaCents: inscriptionIva.ivaCents,
    serviceFeeBaseCents: feeIva.baseCents,
    serviceFeeIvaCents: feeIva.ivaCents,
  };
}

export function validateCheckoutBreakdown(b: CheckoutBreakdown): string | null {
  if (b.organizerFiscalNetCents < 0) {
    return "Price too low for fee and IVA absorption";
  }
  if (b.athleteTotalCents > 0 && b.stripeOrganizerTransferCents < 0) {
    return "Invalid checkout breakdown";
  }
  return null;
}

/** Athlete-facing checkout total for a category list/sticker price. */
export function athleteFacingTotalCents(
  listPriceCents: number,
  serviceFeePercent: number,
  feePresentation: FeePresentation,
): number {
  return computeCheckoutBreakdown({
    listPriceCents,
    serviceFeePercent,
    feePresentation,
  }).athleteTotalCents;
}

/** Category + add-ons combined into one checkout breakdown (discount applies to category only). */
export function computeCheckoutWithExtras(opts: {
  categoryListPriceCents: number;
  extrasSubtotalCents: number;
  serviceFeePercent: number;
  feePresentation?: FeePresentation;
}): CheckoutBreakdown & { extrasSubtotalCents: number; categoryListPriceCents: number } {
  const categoryListPriceCents = Math.max(0, Math.round(opts.categoryListPriceCents));
  const extrasSubtotalCents = Math.max(0, Math.round(opts.extrasSubtotalCents));
  const combinedList = categoryListPriceCents + extrasSubtotalCents;
  return {
    ...computeCheckoutBreakdown({
      listPriceCents: combinedList,
      serviceFeePercent: opts.serviceFeePercent,
      feePresentation: opts.feePresentation,
    }),
    extrasSubtotalCents,
    categoryListPriceCents,
  };
}

export function validatePaidCategoryPricing(opts: {
  name: string;
  priceCents: number;
  serviceFeePercent: number;
  feePresentation: FeePresentation;
}): string | null {
  if (opts.priceCents <= 0) return null;
  const breakdown = computeCheckoutBreakdown({
    listPriceCents: opts.priceCents,
    serviceFeePercent: opts.serviceFeePercent,
    feePresentation: opts.feePresentation,
  });
  const err = validateCheckoutBreakdown(breakdown);
  if (!err) return null;
  return `Category "${opts.name}": ${err}`;
}

export function computeCheckoutBreakdown(opts: {
  listPriceCents?: number;
  serviceFeePercent: number;
  feePresentation?: FeePresentation;
  /** @deprecated Use listPriceCents */
  inscriptionCents?: number;
}): CheckoutBreakdown {
  const listPriceCents = Math.max(
    0,
    Math.round(opts.listPriceCents ?? opts.inscriptionCents ?? 0),
  );
  const serviceFeePercent = Math.max(0, opts.serviceFeePercent);
  const mode = opts.feePresentation ?? "pass_through";

  if (mode === "absorb_all") {
    const serviceFeeCents = calcServiceFeeCents(listPriceCents, serviceFeePercent);
    const displayIvaCents = calcDisplayIvaCents(listPriceCents);
    const athleteTotalCents = listPriceCents;
    const stripePlatformFeeCents = serviceFeeCents;
    const stripeOrganizerTransferCents = listPriceCents - serviceFeeCents;
    const organizerFiscalNetCents = listPriceCents - serviceFeeCents - displayIvaCents;

    return attachLegacyFields({
      mode,
      listPriceCents,
      serviceFeePercent,
      serviceFeeCents,
      displayIvaCents,
      athleteTotalCents,
      organizerFiscalNetCents,
      stripeOrganizerTransferCents,
      stripePlatformFeeCents,
      organizerCfdiGrossCents: stripeOrganizerTransferCents,
      platformCfdiGrossCents: stripePlatformFeeCents,
    });
  }

  const serviceFeeCents = calcServiceFeeCents(listPriceCents, serviceFeePercent);
  const athleteTotalCents = listPriceCents + serviceFeeCents;
  const displayIvaCents = calcDisplayIvaCents(listPriceCents) + calcDisplayIvaCents(serviceFeeCents);

  return attachLegacyFields({
    mode,
    listPriceCents,
    serviceFeePercent,
    serviceFeeCents,
    displayIvaCents,
    athleteTotalCents,
    organizerFiscalNetCents: listPriceCents,
    stripeOrganizerTransferCents: listPriceCents,
    stripePlatformFeeCents: serviceFeeCents,
    organizerCfdiGrossCents: listPriceCents,
    platformCfdiGrossCents: serviceFeeCents,
  });
}

function computeDiscountAmountCents(
  baseCents: number,
  discountType: "percent" | "fixed_cents",
  discountValue: number,
): number {
  if (baseCents <= 0) return 0;
  if (discountType === "percent") {
    return Math.min(baseCents, Math.round(baseCents * (discountValue / 100)));
  }
  return Math.min(baseCents, Math.round(discountValue));
}

export function applyDiscountToCheckout(opts: {
  listPriceCents: number;
  serviceFeePercent: number;
  feePresentation: FeePresentation;
  discount: {
    discount_type: "percent" | "fixed_cents";
    discount_value: number;
    applies_to: DiscountAppliesTo;
    min_purchase_cents: number | null;
  };
}): {
  breakdown: CheckoutBreakdown;
  discountAmountCents: number;
} {
  const base = computeCheckoutBreakdown({
    listPriceCents: opts.listPriceCents,
    serviceFeePercent: opts.serviceFeePercent,
    feePresentation: opts.feePresentation,
  });

  let discountAmountCents = 0;
  let adjustedList = base.listPriceCents;
  let adjustedFee = base.serviceFeeCents;

  const { discount } = opts;

  if (discount.applies_to === "registration") {
    const regBase = base.listPriceCents;
    if (discount.min_purchase_cents != null && regBase < Number(discount.min_purchase_cents)) {
      throw new Error("Minimum purchase not met for this discount");
    }
    discountAmountCents = computeDiscountAmountCents(
      regBase,
      discount.discount_type,
      Number(discount.discount_value),
    );
    adjustedList = Math.max(0, base.listPriceCents - discountAmountCents);
  } else if (discount.applies_to === "service_fee") {
    const feeBase = base.serviceFeeCents;
    if (discount.min_purchase_cents != null && feeBase < Number(discount.min_purchase_cents)) {
      throw new Error("Minimum purchase not met for this discount");
    }
    discountAmountCents = computeDiscountAmountCents(
      feeBase,
      discount.discount_type,
      Number(discount.discount_value),
    );
    adjustedFee = Math.max(0, base.serviceFeeCents - discountAmountCents);
    const breakdown = computeCheckoutBreakdown({
      listPriceCents: adjustedList,
      serviceFeePercent: opts.serviceFeePercent,
      feePresentation: opts.feePresentation,
    });
    if (opts.feePresentation === "absorb_all") {
      return {
        breakdown: attachLegacyFields({
          ...breakdown,
          serviceFeeCents: adjustedFee,
          stripePlatformFeeCents: adjustedFee,
          platformCfdiGrossCents: adjustedFee,
          stripeOrganizerTransferCents: breakdown.listPriceCents - adjustedFee,
          organizerCfdiGrossCents: breakdown.listPriceCents - adjustedFee,
          organizerFiscalNetCents:
            breakdown.listPriceCents - adjustedFee - breakdown.displayIvaCents,
          athleteTotalCents: breakdown.listPriceCents,
        }),
        discountAmountCents,
      };
    }
    return {
      breakdown: attachLegacyFields({
        ...breakdown,
        serviceFeeCents: adjustedFee,
        stripePlatformFeeCents: adjustedFee,
        platformCfdiGrossCents: adjustedFee,
        athleteTotalCents: breakdown.listPriceCents + adjustedFee,
      }),
      discountAmountCents,
    };
  } else {
    const totalBase = base.athleteTotalCents;
    if (discount.min_purchase_cents != null && totalBase < Number(discount.min_purchase_cents)) {
      throw new Error("Minimum purchase not met for this discount");
    }
    discountAmountCents = computeDiscountAmountCents(
      totalBase,
      discount.discount_type,
      Number(discount.discount_value),
    );
    if (opts.feePresentation === "absorb_all") {
      adjustedList = Math.max(0, base.listPriceCents - discountAmountCents);
    } else {
      const fromReg = Math.min(base.listPriceCents, discountAmountCents);
      adjustedList = base.listPriceCents - fromReg;
      const remainder = discountAmountCents - fromReg;
      adjustedFee = Math.max(0, base.serviceFeeCents - remainder);
      const breakdown = computeCheckoutBreakdown({
        listPriceCents: adjustedList,
        serviceFeePercent: opts.serviceFeePercent,
        feePresentation: opts.feePresentation,
      });
      return {
        breakdown: attachLegacyFields({
          ...breakdown,
          serviceFeeCents: adjustedFee,
          stripePlatformFeeCents: adjustedFee,
          platformCfdiGrossCents: adjustedFee,
          athleteTotalCents: adjustedList + adjustedFee,
        }),
        discountAmountCents,
      };
    }
  }

  const breakdown = computeCheckoutBreakdown({
    listPriceCents: adjustedList,
    serviceFeePercent: opts.serviceFeePercent,
    feePresentation: opts.feePresentation,
  });
  const validationError = validateCheckoutBreakdown(breakdown);
  if (validationError) {
    throw new Error(validationError);
  }
  return { breakdown, discountAmountCents };
}

export function formatMxnFromCents(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
