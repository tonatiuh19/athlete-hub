/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8080";
let liveServer = false;

describe("smoke: GET /api/public/teams", () => {
  beforeAll(async () => {
    try {
      const res = await request(BASE).get("/api/public/teams?limit=1").timeout({ deadline: 3000 });
      liveServer = res.status === 200;
    } catch {
      liveServer = false;
    }
  });

  it("returns list envelope", async (ctx) => {
    if (!liveServer) ctx.skip();

    const res = await request(BASE).get("/api/public/teams?limit=5");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.teams)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.page).toBe(1);
  });

  it("returns 404 for unknown slug", async (ctx) => {
    if (!liveServer) ctx.skip();

    const res = await request(BASE).get("/api/public/teams/no-such-triboo-slug-xyz");
    expect(res.status).toBe(404);
  });
});
