import { describe, it, expect } from "vitest";
import { marketplaceSearchInputClass } from "../../client/components/events/marketplaceSearchBarStyles";

describe("marketplaceSearchInputClass", () => {
  it("uses semantic foreground tokens for text and placeholder (theme-safe on bg-card)", () => {
    const cls = marketplaceSearchInputClass();
    expect(cls).toContain("text-foreground");
    expect(cls).toContain("placeholder:text-muted-foreground");
    expect(cls).not.toContain("text-white");
    expect(cls).not.toContain("placeholder:text-white");
  });
});
