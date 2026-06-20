import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  resolveFeePresentation,
  resolveServiceFeePercent,
  validatePaidCategoryPricing,
} from "../shared/checkoutBreakdown.js";

export async function validateEventPublishPricing(
  pool: Pool,
  eventId: number,
  categories: RowDataPacket[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [[feeRow]] = await pool.query<RowDataPacket[]>(
    `SELECT e.fee_presentation, e.service_fee_percent,
            o.fee_presentation AS org_fee_presentation,
            o.service_fee_percent AS org_fee_percent
     FROM events e
     JOIN organizers o ON o.id = e.organizer_id
     WHERE e.id = ? AND e.deleted_at IS NULL
     LIMIT 1`,
    [eventId],
  );
  if (!feeRow) {
    return { ok: false, error: "Event not found" };
  }

  const feePresentation = resolveFeePresentation(
    feeRow.fee_presentation as string | null,
    feeRow.org_fee_presentation as string | null,
  );
  const serviceFeePercent = resolveServiceFeePercent(
    feeRow.service_fee_percent as number | string | null,
    feeRow.org_fee_percent as number | string | null,
  );

  for (const cat of categories) {
    if (!cat.is_active || Number(cat.price_cents) <= 0) continue;
    const err = validatePaidCategoryPricing({
      name: String(cat.name ?? "Category"),
      priceCents: Number(cat.price_cents),
      serviceFeePercent,
      feePresentation,
    });
    if (err) return { ok: false, error: err };
  }

  return { ok: true };
}
