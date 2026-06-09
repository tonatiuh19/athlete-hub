// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { resolveSsoReturnTo } from "@/utils/ssoReturnStorage";

describe("smoke: clerk OAuth redirect", () => {
  it("resolveSsoReturnTo prefers session storage then query param", () => {
    sessionStorage.setItem("triboo_sso_return_to", "/events/trail-nevado-toluca-2026");
    expect(resolveSsoReturnTo("/portal")).toBe("/events/trail-nevado-toluca-2026");
    expect(resolveSsoReturnTo("/portal")).toBe("/portal");
  });

  it("rejects unsafe return paths", () => {
    expect(resolveSsoReturnTo("//evil.com")).toBeNull();
    expect(resolveSsoReturnTo("https://evil.com")).toBeNull();
  });
});
