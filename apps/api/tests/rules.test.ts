jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    on: jest.fn(),
  }));
});

jest.mock("../src/lib/db", () => ({
  query: jest.fn().mockImplementation(() => Promise.resolve({ rows: [] })),
}));

jest.mock("../src/lib/cache", () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

import { evaluateIngredients } from "../src/rules/engine";
import { query } from "../src/lib/db";

describe("evaluateIngredients - Rules Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes("dietary_protocols")) {
        return { rows: [] };
      }
      if (sql.includes("ingredients")) {
        return {
          rows: [
            { id: "sugar_id", name: "sugar", category: "sugars", banned_by: [] },
            { id: "wheat_flour_id", name: "wheat flour", category: "grains", banned_by: [] },
            { id: "milk_id", name: "milk", category: "dairy", banned_by: [] },
            { id: "eggs_id", name: "eggs", category: "eggs", banned_by: [] },
            { id: "honey_id", name: "honey", category: "sugars", banned_by: [] },
          ],
        };
      }
      if (sql.includes("ingredient_aliases")) {
        return { rows: [] };
      }
      if (sql.includes("exclusion_list")) {
        return {
          rows: [
            { phrase: "coconut milk", ingredient_id: "milk_id" },
          ],
        };
      }
      return { rows: [] };
    });
  });

  it("should flag sugar and wheat flour under the Keto protocol", async () => {
    const report = await evaluateIngredients("keto", ["sugar", "wheat flour", "olive oil"]);
    expect(report.passed).toBe(false);
    expect(report.flaggedIngredients).toContain("sugar");
    expect(report.flaggedIngredients).toContain("wheat flour");
    expect(report.compliantIngredients).toContain("olive oil");
  });

  it("should flag milk, eggs, and honey under the Vegan protocol", async () => {
    const report = await evaluateIngredients("vegan", ["milk", "eggs", "honey", "spinach"]);
    expect(report.passed).toBe(false);
    expect(report.flaggedIngredients).toContain("milk");
    expect(report.flaggedIngredients).toContain("eggs");
    expect(report.flaggedIngredients).toContain("honey");
    expect(report.compliantIngredients).toContain("spinach");
  });

  it("should not flag coconut milk as dairy (using exclusion list)", async () => {
    const report = await evaluateIngredients("vegan", ["coconut milk", "spinach"]);
    expect(report.flaggedIngredients).not.toContain("coconut milk");
    expect(report.compliantIngredients).toContain("coconut milk");
    expect(report.passed).toBe(true);
  });
});
