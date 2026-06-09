/**
 * @vitest-environment node
 *
 * Optional live-server smoke tests. Skipped when dev server is not running.
 * Run with: npm run dev & SMOKE_BASE_URL=http://127.0.0.1:8080 npx vitest run tests/smoke/events-marketplace-api-filters.spec.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8080";
let liveServer = false;

describe("smoke: GET /api/events marketplace filters", () => {
  beforeAll(async () => {
    try {
      const res = await request(BASE)
        .get("/api/events?limit=1")
        .timeout({ deadline: 3000 });
      liveServer = res.status === 200;
    } catch {
      liveServer = false;
    }
  });

  it("returns a stable list envelope", async (ctx) => {
    if (!liveServer) ctx.skip();

    const res = await request(BASE).get("/api/events?limit=5");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });

  it("filters by sport slug", async (ctx) => {
    if (!liveServer) ctx.skip();

    const all = await request(BASE).get("/api/events?limit=50");
    const sport = all.body.events[0]?.sport_slug;
    if (!sport) return;

    const filtered = await request(BASE).get(
      `/api/events?sport=${encodeURIComponent(sport)}&limit=50`,
    );
    expect(filtered.status).toBe(200);
    expect(
      filtered.body.events.every(
        (e: { sport_slug: string }) => e.sport_slug === sport,
      ),
    ).toBe(true);
  });

  it("returns empty for unknown geoCityId", async (ctx) => {
    if (!liveServer) ctx.skip();

    const res = await request(BASE).get("/api/events?geoCityId=999999&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("accepts inclusive dateTo for same-day events", async (ctx) => {
    if (!liveServer) ctx.skip();

    const all = await request(BASE).get("/api/events?limit=50&sort=date_asc");
    const sample = all.body.events.find(
      (e: { start_date: string }) => e.start_date,
    );
    if (!sample) return;

    const day = String(sample.start_date).slice(0, 10);
    const res = await request(BASE).get(
      `/api/events?dateFrom=${day}&dateTo=${day}&limit=50`,
    );
    expect(res.status).toBe(200);
    expect(
      res.body.events.some((e: { slug: string }) => e.slug === sample.slug),
    ).toBe(true);
  });

  it("normalizes inverted date range server-side", async (ctx) => {
    if (!liveServer) ctx.skip();

    const res = await request(BASE).get(
      "/api/events?dateFrom=2026-12-31&dateTo=2026-01-01&limit=5",
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it("fuzzy search matches accent-folded queries", async (ctx) => {
    if (!liveServer) ctx.skip();

    const all = await request(BASE).get("/api/events?limit=50");
    const accented = all.body.events.find((e: { title: string }) =>
      /[áéíóúñ]/i.test(e.title),
    );
    if (!accented) return;

    const folded = String(accented.title)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/\s+/)[0]
      .slice(0, 6);
    if (folded.length < 2) return;

    const res = await request(BASE).get(
      `/api/events?q=${encodeURIComponent(folded.toLowerCase())}&limit=50`,
    );
    expect(res.status).toBe(200);
    expect(
      res.body.events.some((e: { slug: string }) => e.slug === accented.slug),
    ).toBe(true);
  });
});
