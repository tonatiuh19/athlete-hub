import { describe, expect, it } from "vitest";
import { isUnrecoverableStripeConnectAccountError } from "../../server/stripeConnect";

describe("isUnrecoverableStripeConnectAccountError", () => {
  it("detects platform key mismatch / revoked access", () => {
    expect(
      isUnrecoverableStripeConnectAccountError(
        new Error(
          "The provided key 'sk_live_xxx' does not have access to account 'acct_1TsD71K5fVNYiBce' (or that account does not exist). Application access may have been revoked.",
        ),
      ),
    ).toBe(true);
  });

  it("detects Stripe error codes for missing/invalid accounts", () => {
    expect(
      isUnrecoverableStripeConnectAccountError({ code: "resource_missing" }),
    ).toBe(true);
    expect(
      isUnrecoverableStripeConnectAccountError({ code: "account_invalid" }),
    ).toBe(true);
  });

  it("ignores transient / unrelated failures", () => {
    expect(
      isUnrecoverableStripeConnectAccountError(new Error("ECONNRESET")),
    ).toBe(false);
    expect(
      isUnrecoverableStripeConnectAccountError(new Error("Rate limit exceeded")),
    ).toBe(false);
    expect(isUnrecoverableStripeConnectAccountError(null)).toBe(false);
  });
});
