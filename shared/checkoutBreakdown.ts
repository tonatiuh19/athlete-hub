/** Platform default service fee % (IVA included in displayed amounts). */
export const DEFAULT_SERVICE_FEE_PERCENT = 11;

/** Mexican IVA rate for informative sub-breakdown only. */
export const MX_IVA_RATE = 0.16;

export function calcServiceFeeCents(priceCents: number, feePercent: number): number {
  if (priceCents <= 0 || feePercent <= 0) return 0;
  return Math.round(priceCents * (feePercent / 100));
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
  inscriptionCents: number;
  serviceFeePercent: number;
  serviceFeeCents: number;
  totalCents: number;
  organizerReceivesCents: number;
  platformFeeCents: number;
  inscriptionBaseCents: number;
  inscriptionIvaCents: number;
  serviceFeeBaseCents: number;
  serviceFeeIvaCents: number;
}

function ivaPartsFromGrossCents(grossCents: number): { baseCents: number; ivaCents: number } {
  if (grossCents <= 0) return { baseCents: 0, ivaCents: 0 };
  const baseCents = Math.round(grossCents / (1 + MX_IVA_RATE));
  return { baseCents, ivaCents: grossCents - baseCents };
}

export function computeCheckoutBreakdown(opts: {
  inscriptionCents: number;
  serviceFeePercent: number;
}): CheckoutBreakdown {
  const inscriptionCents = Math.max(0, Math.round(opts.inscriptionCents));
  const serviceFeePercent = Math.max(0, opts.serviceFeePercent);
  const serviceFeeCents = calcServiceFeeCents(inscriptionCents, serviceFeePercent);
  const totalCents = inscriptionCents + serviceFeeCents;
  const inscriptionIva = ivaPartsFromGrossCents(inscriptionCents);
  const feeIva = ivaPartsFromGrossCents(serviceFeeCents);

  return {
    inscriptionCents,
    serviceFeePercent,
    serviceFeeCents,
    totalCents,
    organizerReceivesCents: inscriptionCents,
    platformFeeCents: serviceFeeCents,
    inscriptionBaseCents: inscriptionIva.baseCents,
    inscriptionIvaCents: inscriptionIva.ivaCents,
    serviceFeeBaseCents: feeIva.baseCents,
    serviceFeeIvaCents: feeIva.ivaCents,
  };
}

export function formatMxnFromCents(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
