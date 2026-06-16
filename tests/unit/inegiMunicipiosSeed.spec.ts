import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const seedPath = join(
  process.cwd(),
  "database",
  "seed",
  "mx_municipios_inegi.json",
);

describe("INEGI municipios seed", () => {
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
    count: number;
    municipios: Array<{
      cvegeo: string;
      cve_ent: string;
      cve_mun: string;
      name: string;
      state_code: string;
    }>;
  };

  it("contains all 32 states and 2478 municipios", () => {
    expect(seed.count).toBe(2478);
    expect(seed.municipios).toHaveLength(2478);
    const states = new Set(seed.municipios.map((m) => m.state_code));
    expect(states.size).toBe(32);
  });

  it("uses unique cvegeo for every municipio", () => {
    const cvegeos = seed.municipios.map((m) => m.cvegeo);
    expect(new Set(cvegeos).size).toBe(cvegeos.length);
  });

  it("disambiguates homonymous municipio names within a state", () => {
    const namesByState = new Map<string, Set<string>>();
    for (const m of seed.municipios) {
      const key = `${m.state_code}|${m.name}`;
      const set = namesByState.get(m.state_code) ?? new Set<string>();
      expect(set.has(m.name)).toBe(false);
      set.add(m.name);
      namesByState.set(m.state_code, set);
    }
  });

  it("includes small Yucatán municipios staff may need", () => {
    const yuc = seed.municipios.filter((m) => m.state_code === "YUC");
    expect(yuc.some((m) => m.name === "Kantunil")).toBe(true);
    expect(yuc.some((m) => m.name === "Izamal")).toBe(true);
    expect(yuc).toHaveLength(106);
  });

  it("maps cve_ent to the correct state code", () => {
    const expected: Record<string, string> = {
      "05": "COA",
      "06": "COL",
      "07": "CHP",
      "08": "CHH",
    };
    for (const m of seed.municipios) {
      const want = expected[m.cve_ent];
      if (want) {
        expect(m.state_code).toBe(want);
      }
      expect(m.cvegeo.startsWith(m.cve_ent)).toBe(true);
    }
  });

  it("includes Tapilula in Chiapas", () => {
    const tapilula = seed.municipios.find((m) => m.name === "Tapilula");
    expect(tapilula).toBeDefined();
    expect(tapilula?.cve_ent).toBe("07");
    expect(tapilula?.state_code).toBe("CHP");
  });
});
