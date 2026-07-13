import type { CheckoutBreakdownSnapshot, FeePresentation } from "../shared/checkoutBreakdown.js";
import type { ResolvedExtraLine } from "../shared/eventExtras.js";
import type { GroupCheckoutLineItemResolved } from "../shared/groupCheckout.js";
import type { ExtraFieldAnswersInput } from "./eventExtras.js";
import { parseWaiverSignatures, type WaiverSignatureInput } from "./eventWaivers.js";

export type CheckoutPaymentMetadata = {
  categoryId: number;
  fieldValues: Record<string, string | boolean>;
  categoryName: string;
  feePresentation?: FeePresentation;
  breakdown?: CheckoutBreakdownSnapshot;
  categoryListPriceCents?: number;
  extrasSubtotalCents?: number;
  selectedExtras?: ResolvedExtraLine[];
  extraFieldAnswers?: ExtraFieldAnswersInput;
  waiverSignatures?: WaiverSignatureInput[];
  /** @deprecated legacy single-waiver checkout */
  waiverId?: number;
  waiverSignature?: string;
  waiverAcceptedAt?: string;
  clientIp?: string;
  userAgent?: string;
  deviceInfo?: string;
  discountCodeId?: number;
  discountCode?: string;
  discountAmountCents?: number;
  waitlistEntryId?: number;
};

export type GroupCheckoutPaymentMetadata = CheckoutPaymentMetadata & {
  orderMode: "group";
  orderPublicUuid: string;
  lineItems: GroupCheckoutLineItemResolved[];
  itemCount: number;
};

export function isGroupCheckoutMetadata(
  meta: CheckoutPaymentMetadata | GroupCheckoutPaymentMetadata,
): meta is GroupCheckoutPaymentMetadata {
  return (meta as GroupCheckoutPaymentMetadata).orderMode === "group";
}

export function parseCheckoutPaymentMetadata(
  raw: unknown,
): CheckoutPaymentMetadata | GroupCheckoutPaymentMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const orderMode = data.orderMode === "group" ? "group" : "single";

  if (orderMode === "group") {
    const orderPublicUuid = String(data.orderPublicUuid ?? "").trim();
    const lineItemsRaw = data.lineItems;
    if (!orderPublicUuid || !Array.isArray(lineItemsRaw) || lineItemsRaw.length === 0) {
      return null;
    }
    const lineItems = lineItemsRaw as GroupCheckoutLineItemResolved[];
    const firstCategoryId = Number(lineItems[0]?.categoryId);
    if (!Number.isFinite(firstCategoryId)) return null;
    const shared = parseSharedCheckoutFields(data);
    return {
      categoryId: firstCategoryId,
      fieldValues: {},
      categoryName: lineItems.map((l) => l.categoryName).join(", "),
      ...shared,
      orderMode: "group",
      orderPublicUuid,
      lineItems,
      itemCount: Number(data.itemCount) || lineItems.length,
    };
  }

  const single = parseSingleCheckoutFields(data);
  return single;
}

function parseSingleCheckoutFields(data: Record<string, unknown>): CheckoutPaymentMetadata | null {
  const categoryId = Number(data.categoryId);
  if (!Number.isFinite(categoryId)) return null;
  const shared = parseSharedCheckoutFields(data);
  const fieldValues = (data.fieldValues ?? {}) as Record<string, string | boolean>;
  const categoryName = String(data.categoryName ?? "");
  return {
    categoryId,
    fieldValues,
    categoryName,
    ...shared,
  };
}

function parseSharedCheckoutFields(data: Record<string, unknown>): {
  waiverSignatures?: import("./eventWaivers.js").WaiverSignatureInput[];
  waiverId?: number;
  waiverSignature?: string;
  waiverAcceptedAt?: string;
  clientIp?: string;
  userAgent?: string;
  deviceInfo?: string;
  discountCodeId?: number;
  discountCode?: string;
  discountAmountCents?: number;
  feePresentation?: FeePresentation;
  breakdown?: CheckoutBreakdownSnapshot;
  waitlistEntryId?: number;
  categoryListPriceCents?: number;
  extrasSubtotalCents?: number;
  selectedExtras?: ResolvedExtraLine[];
  extraFieldAnswers?: ExtraFieldAnswersInput;
} {
  const waiverSignaturesRaw = data.waiverSignatures;
  let waiverSignatures: WaiverSignatureInput[] | undefined;
  if (Array.isArray(waiverSignaturesRaw)) {
    const parsed = parseWaiverSignatures({ waiverSignatures: waiverSignaturesRaw });
    if (parsed) waiverSignatures = parsed;
  }
  const waiverId =
    data.waiverId != null && Number.isFinite(Number(data.waiverId))
      ? Number(data.waiverId)
      : undefined;
  const waiverSignature =
    data.waiverSignature != null ? String(data.waiverSignature).trim() : undefined;
  const waiverAcceptedAt =
    data.waiverAcceptedAt != null ? String(data.waiverAcceptedAt) : undefined;
  const clientIp = data.clientIp != null ? String(data.clientIp) : undefined;
  const userAgent = data.userAgent != null ? String(data.userAgent) : undefined;
  const deviceInfo = data.deviceInfo != null ? String(data.deviceInfo) : undefined;
  const discountCodeId =
    data.discountCodeId != null && Number.isFinite(Number(data.discountCodeId))
      ? Number(data.discountCodeId)
      : undefined;
  const discountCode =
    data.discountCode != null ? String(data.discountCode).trim() : undefined;
  const discountAmountCents =
    data.discountAmountCents != null && Number.isFinite(Number(data.discountAmountCents))
      ? Number(data.discountAmountCents)
      : undefined;
  const feePresentation: FeePresentation | undefined =
    data.feePresentation === "absorb_all" || data.feePresentation === "pass_through"
      ? data.feePresentation
      : undefined;
  const breakdownRaw = data.breakdown;
  const breakdown =
    breakdownRaw && typeof breakdownRaw === "object"
      ? (breakdownRaw as CheckoutBreakdownSnapshot)
      : undefined;
  const waitlistEntryId =
    data.waitlistEntryId != null && Number.isFinite(Number(data.waitlistEntryId))
      ? Number(data.waitlistEntryId)
      : undefined;
  const categoryListPriceCents =
    data.categoryListPriceCents != null &&
    Number.isFinite(Number(data.categoryListPriceCents))
      ? Number(data.categoryListPriceCents)
      : undefined;
  const extrasSubtotalCents =
    data.extrasSubtotalCents != null &&
    Number.isFinite(Number(data.extrasSubtotalCents))
      ? Number(data.extrasSubtotalCents)
      : undefined;
  let selectedExtras: ResolvedExtraLine[] | undefined;
  if (Array.isArray(data.selectedExtras)) {
    selectedExtras = data.selectedExtras
      .map((row) => {
        const item = row as Record<string, unknown>;
        const extraId = Number(item.extraId);
        const quantity = Number(item.quantity);
        const unitPriceCents = Number(item.unitPriceCents);
        const totalCents = Number(item.totalCents);
        const name = String(item.name ?? "");
        if (
          !Number.isFinite(extraId) ||
          !Number.isFinite(quantity) ||
          !Number.isFinite(unitPriceCents) ||
          !Number.isFinite(totalCents) ||
          !name
        ) {
          return null;
        }
        return { extraId, quantity, unitPriceCents, totalCents, name };
      })
      .filter(Boolean) as ResolvedExtraLine[];
  }
  let extraFieldAnswers: ExtraFieldAnswersInput | undefined;
  if (Array.isArray(data.extraFieldAnswers)) {
    extraFieldAnswers = data.extraFieldAnswers
      .map((row) => {
        const item = row as Record<string, unknown>;
        const extraId = Number(item.extraId);
        const values = item.values;
        if (!Number.isFinite(extraId) || extraId <= 0 || !values || typeof values !== "object") {
          return null;
        }
        return { extraId, values: values as Record<string, unknown> };
      })
      .filter(Boolean) as ExtraFieldAnswersInput;
  }
  return {
    waiverSignatures,
    waiverId,
    waiverSignature,
    waiverAcceptedAt,
    clientIp,
    userAgent,
    deviceInfo,
    discountCodeId,
    discountCode,
    discountAmountCents,
    feePresentation,
    breakdown,
    waitlistEntryId,
    categoryListPriceCents,
    extrasSubtotalCents,
    selectedExtras,
    extraFieldAnswers,
  };
}
