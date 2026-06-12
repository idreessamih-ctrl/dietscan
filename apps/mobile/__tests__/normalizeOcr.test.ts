import { normalizeOcrText } from "../src/lib/normalizeOcr";
import { getAllDbIngredients } from "../src/services/db";

// Mock the SQLite services/db module
jest.mock("../src/services/db", () => ({
  getAllDbIngredients: jest.fn(),
}));

describe("normalizeOcrText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup a mock dictionary of ingredients
    (getAllDbIngredients as jest.Mock).mockResolvedValue([
      { id: "1", name: "milk", category: "dairy", bannedBy: [], aliases: [], updated_at: "" },
      { id: "2", name: "sugar", category: "sweetener", bannedBy: [], aliases: [], updated_at: "" },
      { id: "3", name: "wheat flour", category: "grain", bannedBy: [], aliases: [], updated_at: "" },
      { id: "4", name: "eggs", category: "eggs", bannedBy: [], aliases: [], updated_at: "" },
      { id: "5", name: "honey", category: "sweetener", bannedBy: [], aliases: [], updated_at: "" },
      { id: "6", name: "whey", category: "dairy", bannedBy: [], aliases: [], updated_at: "" },
      { id: "7", name: "casein", category: "dairy", bannedBy: [], aliases: [], updated_at: "" },
    ]);
  });

  it("should correct common OCR errors like m1lk to milk using Levenshtein distance", async () => {
    const result = await normalizeOcrText("m1lk");
    expect(result).toContain("milk");
  });

  it("should not flag or correct coconut milk as dairy (remains as coconut milk)", async () => {
    const result = await normalizeOcrText("coconut milk");
    expect(result).toContain("coconut milk");
    expect(result).not.toContain("milk");
  });

  it("should extract sub-ingredients from parenthesized lists like Protein Blend (Whey, Casein)", async () => {
    const result = await normalizeOcrText("Protein Blend (Whey, Casein)");
    expect(result).toContain("protein blend");
    expect(result).toContain("whey");
    expect(result).toContain("casein");
  });
});
