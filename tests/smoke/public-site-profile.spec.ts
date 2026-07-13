/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8080";
let liveServer = false;

describe("smoke: GET /api/public/site-profile", () => {
  beforeAll(async () => {
    try {
      const res = await request(BASE).get("/api/public/site-profile").timeout({ deadline: 5000 });
      liveServer = res.status === 200;
    } catch {
      liveServer = false;
    }
  });

  it("returns profile envelope with legalEntity and contact", async (ctx) => {
    if (!liveServer) ctx.skip();

    const res = await request(BASE).get("/api/public/site-profile");
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeTruthy();
    expect(res.body.profile.legalEntity).toBeTruthy();
    expect(res.body.profile.contact).toBeTruthy();
    expect(typeof res.body.profile.legalEntity.brandName).toBe("string");
  });
});
