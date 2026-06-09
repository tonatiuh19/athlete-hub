import { parseWaiverSignatures, type WaiverSignatureInput } from "./eventWaivers.js";

export type CheckoutPaymentMetadata = {
  categoryId: number;
  fieldValues: Record<string, string | boolean>;
  categoryName: string;
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

export function parseCheckoutPaymentMetadata(raw: unknown): CheckoutPaymentMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const categoryId = Number(data.categoryId);
  if (!Number.isFinite(categoryId)) return null;
  const fieldValues = (data.fieldValues ?? {}) as Record<string, string | boolean>;
  const categoryName = String(data.categoryName ?? "");
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
  const waitlistEntryId =
    data.waitlistEntryId != null && Number.isFinite(Number(data.waitlistEntryId))
      ? Number(data.waitlistEntryId)
      : undefined;
  return {
    categoryId,
    fieldValues,
    categoryName,
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
    waitlistEntryId,
  };
}
