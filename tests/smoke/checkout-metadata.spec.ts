import { describe, it, expect } from "vitest";
import { parseCheckoutPaymentMetadata } from "../../server/checkoutMetadata";
import fixtures from "../fixtures/registration-flow.json";

describe("smoke: checkout payment metadata round-trip", () => {
  it("parses valid multi-waiver checkout metadata from payment.metadata_json shape", () => {
    const meta = parseCheckoutPaymentMetadata(fixtures.validMultiWaiverCheckout);
    expect(meta).not.toBeNull();
    expect(meta!.categoryId).toBe(10);
    expect(meta!.categoryName).toBe("10K Elite");
    expect(meta!.fieldValues).toMatchObject({ shirt_size: "M" });
    expect(meta!.waiverSignatures).toHaveLength(2);
    expect(meta!.waiverSignatures![0].waiverVersion).toBe(2);
    expect(meta!.discountCode).toBe("EARLY10");
    expect(meta!.discountAmountCents).toBe(5000);
  });

  it("parses legacy single-waiver metadata", () => {
    const meta = parseCheckoutPaymentMetadata(fixtures.legacySingleWaiver);
    expect(meta!.waiverId).toBe(1);
    expect(meta!.waiverSignature).toBe("ACCEPTED");
  });

  it("rejects metadata without categoryId", () => {
    expect(parseCheckoutPaymentMetadata(fixtures.missingCategoryId)).toBeNull();
    expect(parseCheckoutPaymentMetadata(null)).toBeNull();
    expect(parseCheckoutPaymentMetadata("not-json")).toBeNull();
  });

  it("preserves stale waiver version in metadata for finalize-time validation", () => {
    const meta = parseCheckoutPaymentMetadata(fixtures.staleWaiverVersion);
    expect(meta!.waiverSignatures![0].waiverVersion).toBe(1);
  });

  it("round-trips through JSON.stringify as stored in payments.metadata_json", () => {
    const raw = JSON.parse(JSON.stringify(fixtures.validMultiWaiverCheckout));
    const meta = parseCheckoutPaymentMetadata(raw);
    expect(meta!.waiverSignatures![1].waiverId).toBe(2);
  });
});

describe("smoke: API response fixtures (client contract)", () => {
  it("pending-checkout fixture matches PendingCheckoutItem shape", () => {
    const item = fixtures.pendingCheckoutResponse.pending[0];
    expect(item.public_uuid).toBeTruthy();
    expect(item.category_id).toBe(10);
    expect(item.status).toBe("pending");
  });

  it("confirm 402 requiresAction fixture matches saved-card 3DS contract", () => {
    const body = fixtures.confirmRequiresAction;
    expect(body.requiresAction).toBe(true);
    expect(body.clientSecret).toMatch(/^pi_/);
  });

  it("confirm success fixture includes registration folio fields", () => {
    const reg = fixtures.confirmSuccess.registration;
    expect(reg.status).toBe("confirmed");
    expect(reg.registration_number).toMatch(/^EVT-/);
    expect(reg.qr_code_token).toBeTruthy();
  });
});
