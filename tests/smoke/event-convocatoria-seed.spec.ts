import { describe, it, expect } from "vitest";
import { EVENT_CONVOCATORIA_SEEDS } from "../../database/seed/eventConvocatorias";

describe("smoke: event convocatoria seed content", () => {
  it("covers all five mock event slugs with rich HTML", () => {
    const slugs = EVENT_CONVOCATORIA_SEEDS.map((e) => e.slug);
    expect(slugs).toEqual([
      "maraton-cdmx-2026",
      "trail-nevado-toluca-2026",
      "triatlon-acapulco-2026",
      "carrera-10k-polanco-2026",
      "hyrox-mexico-city-2025",
    ]);
    for (const event of EVENT_CONVOCATORIA_SEEDS) {
      expect(event.descriptionHtml).toContain("<h2>");
      expect(event.descriptionHtml).toContain("<ul>");
      expect(event.heroImageUrl).toContain("images.unsplash.com");
      expect(event.bannerImageUrl).toContain("images.unsplash.com");
    }
  });
});
