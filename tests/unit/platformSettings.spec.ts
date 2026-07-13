import { describe, it, expect, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import { DEFAULT_SITE_PUBLIC_PROFILE } from "../../shared/siteLegal.js";
import {
  fetchSitePublicProfile,
  SITE_PUBLIC_PROFILE_KEY,
} from "../../server/platformSettings.js";

describe("fetchSitePublicProfile", () => {
  it("returns defaults when platform_settings table is missing", async () => {
    const pool = {
      query: vi.fn().mockRejectedValue({
        code: "ER_NO_SUCH_TABLE",
        message: "Table 'athlete-hub.platform_settings' doesn't exist",
      }),
    } as unknown as Pool;

    const profile = await fetchSitePublicProfile(pool);
    expect(profile).toEqual(DEFAULT_SITE_PUBLIC_PROFILE);
  });

  it("returns merged profile when row exists", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue([
        [
          {
            setting_value: {
              legalEntity: { brandName: "Custom Brand", supportEmail: "a@b.com" },
            },
          },
        ],
      ]),
    } as unknown as Pool;

    const profile = await fetchSitePublicProfile(pool);
    expect(profile.legalEntity.brandName).toBe("Custom Brand");
    expect(profile.legalEntity.supportEmail).toBe("a@b.com");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("platform_settings"),
      [SITE_PUBLIC_PROFILE_KEY],
    );
  });

  it("returns defaults when no row is stored", async () => {
    const pool = {
      query: vi.fn().mockResolvedValue([[]]),
    } as unknown as Pool;

    const profile = await fetchSitePublicProfile(pool);
    expect(profile).toEqual(DEFAULT_SITE_PUBLIC_PROFILE);
  });
});
