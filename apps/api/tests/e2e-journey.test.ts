/// <reference types="jest" />

// ── Mocks ──
jest.mock("@sentry/node", () => ({ init: jest.fn(), setupExpressErrorHandler: jest.fn(), captureException: jest.fn() }));
jest.mock("supertokens-node", () => ({ init: jest.fn(), getAllCORSHeaders: jest.fn(() => []), getUser: jest.fn().mockResolvedValue({ emails: ["journey@test.com"] }), deleteUser: jest.fn().mockResolvedValue(undefined) }));
jest.mock("supertokens-node/recipe/session", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/emailpassword", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/session/framework/express", () => ({ verifySession: jest.fn(() => (req: any, res: any, next: any) => next()) }));
jest.mock("supertokens-node/framework/express", () => ({ middleware: jest.fn(() => (req: any, res: any, next: any) => next()), errorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)) }));
jest.mock("ioredis", () => jest.fn(() => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue("OK"), on: jest.fn() })));
jest.mock("../src/lib/meilisearch", () => {
  const searchMock = jest.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0, query: "", processingTimeMs: 1, limit: 20, offset: 0 });
  return { meiliClient: { index: jest.fn(() => ({ search: searchMock, updateSettings: jest.fn() })), health: jest.fn().mockResolvedValue({ status: "available" }) }, initMeilisearch: jest.fn() };
});
jest.mock("../src/lib/off", () => ({ lookupBarcode: jest.fn().mockResolvedValue(null) }));

const mockQuery = jest.fn();
jest.mock("../src/lib/db", () => ({ query: mockQuery, pool: {}, db: {} }));

const sessionMock = { getUserId: () => "usr-journey-1", revokeSession: jest.fn().mockResolvedValue(undefined) };
jest.mock("../src/middleware/auth", () => ({
  verifySession: (req: any, res: any, next: any) => { req.session = sessionMock; next(); },
  optionalSession: (req: any, res: any, next: any) => { req.session = sessionMock; next(); },
  resolveUser: (req: any, res: any, next: any) => { req.dbUser = { id: "usr-journey-1", email: "journey@test.com", dietary_protocol: "keto", created_at: new Date() }; next(); },
}));

import request from "supertest";
import app from "../src/index";
import { meiliClient } from "../src/lib/meilisearch";

// ══════════════════════════════════════════════════════════
//  STATEful user journey — one user, one session, full flow
//  Simulates: install → scan → journal → shop → plan → delete
// ══════════════════════════════════════════════════════════

describe("FULL USER JOURNEY", () => {
  const productId = "a0000000-0000-0000-0000-000000000001";
  const productId2 = "a0000000-0000-0000-0000-000000000002";
  let journalId: string;
  let listId: string;
  let planId: string;

  beforeAll(() => {
    // Persistent DB mock — never use mockImplementationOnce for rules engine
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes("dietary_protocols") && sql.includes("slug")) {
        return { rows: [{ slug: "keto", rules_json: { banned_ingredients: ["sugar"], banned_categories: ["grains"], allowed_exceptions: ["stevia"] } }] };
      }
      if (sql.includes("FROM ingredients") && !sql.includes("ingredient_aliases")) {
        return { rows: [{ id: "ing-1", name: "sugar", category: "sugars", banned_by: [] }, { id: "ing-2", name: "stevia", category: "sweeteners", banned_by: [] }] };
      }
      if (sql.includes("ingredient_aliases")) return { rows: [] };
      if (sql.includes("exclusion_list")) return { rows: [] };
      // Default: return rows so inserts/selects don't crash
      return { rows: [], rowCount: 0 };
    });
  });

  beforeEach(() => {
    mockQuery.mockClear();
    // Re-apply persistent mock after clear
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes("dietary_protocols") && sql.includes("slug")) {
        return { rows: [{ slug: "keto", rules_json: { banned_ingredients: ["sugar"], banned_categories: ["grains"], allowed_exceptions: ["stevia"] } }] };
      }
      if (sql.includes("FROM ingredients") && !sql.includes("ingredient_aliases")) {
        return { rows: [{ id: "ing-1", name: "sugar", category: "sugars", banned_by: [] }, { id: "ing-2", name: "stevia", category: "sweeteners", banned_by: [] }] };
      }
      if (sql.includes("ingredient_aliases")) return { rows: [] };
      if (sql.includes("exclusion_list")) return { rows: [] };
      return { rows: [], rowCount: 0 };
    });
  });

  // ── DAY 1: Install & First Scan ──
  it("STEP 1: App checks server health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("STEP 2: User scans barcode → gets product from Open Food Facts", async () => {
    const { lookupBarcode } = require("../src/lib/off");
    lookupBarcode.mockResolvedValueOnce({
      code: "737628064502",
      product: { product_name: "Keto Cookies", brands: "KetoDelight", ingredients_text: "almond flour, butter, eggs, stevia" },
    });
    const res = await request(app).post("/products/lookup").send({ barcode: "737628064502" });
    expect(res.status).toBe(200);
    expect(res.body.product.product_name).toBe("Keto Cookies");
  });

  it("STEP 3: User checks ingredients against Keto protocol", async () => {
    const res = await request(app).post("/scans/ingredients").send({
      ingredients: ["almond flour", "butter", "eggs", "stevia"],
      protocolSlug: "keto",
    });
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true); // All keto-compliant
    expect(res.body.score).toBe(100);
  });

  it("STEP 4: User scans a non-compliant product (contains sugar)", async () => {
    const res = await request(app).post("/scans/ingredients").send({
      ingredients: ["wheat flour", "sugar", "butter"],
      protocolSlug: "keto",
    });
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(false);
    expect(res.body.flaggedIngredients).toContain("sugar");
  });

  // ── DAY 1 Evening: Journal ──
  it("STEP 5: User logs breakfast in journal", async () => {
    mockQuery.mockImplementationOnce(async () => ({
      rows: [{ id: "j-1", userId: "usr-journey-1", mealType: "breakfast", scannedAt: new Date().toISOString(), complianceScore: 100 }],
    }));
    const res = await request(app).post("/journal").send({ mealType: "breakfast", complianceScore: 100 });
    expect(res.status).toBe(201);
    journalId = res.body.id || "j-1";
  });

  it("STEP 6: User logs lunch (non-compliant)", async () => {
    mockQuery.mockImplementationOnce(async () => ({
      rows: [{ id: "j-2", userId: "usr-journey-1", mealType: "lunch", scannedAt: new Date().toISOString(), complianceScore: 50 }],
    }));
    const res = await request(app).post("/journal").send({ mealType: "lunch", complianceScore: 50 });
    expect(res.status).toBe(201);
  });

  it("STEP 7: User views journal", async () => {
    mockQuery.mockImplementationOnce(async () => ({
      rows: [
        { id: "j-2", userId: "usr-journey-1", mealType: "lunch", scannedAt: new Date().toISOString(), complianceScore: 50 },
        { id: "j-1", userId: "usr-journey-1", mealType: "breakfast", scannedAt: new Date().toISOString(), complianceScore: 100 },
      ],
    }));
    const res = await request(app).get("/journal");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("STEP 8: User checks compliance summary", async () => {
    mockQuery.mockImplementationOnce(async () => ({
      rows: [{ totalMeals: 2, averageCompliance: 75, breakfastCount: 1, lunchCount: 1, dinnerCount: 0, snackCount: 0 }],
    }));
    const res = await request(app).get("/journal/summary");
    expect(res.status).toBe(200);
    expect(res.body.averageCompliance).toBe(75);
  });

  // ── Day 2: Nutrition & Planning ──
  it("STEP 9: User checks daily nutrition", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).get("/nutrition/daily?date=2024-06-12");
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });

  it("STEP 10: User views weekly nutrition dashboard", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).get("/nutrition/weekly");
    expect(res.status).toBe(200);
    expect(res.body.dailyData).toHaveLength(7);
    expect(res.body).toHaveProperty("streak");
  });

  it("STEP 11: User plans meals for the week", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT slug FROM dietary_protocols")) return { rows: [{ slug: "keto" }] };
      return { rows: [{ id: "mp-1", userId: "usr-journey-1", weekStart: "2024-06-10", protocolSlug: "keto" }] };
    });
    const res = await request(app).post("/meal-plans").send({ weekStart: "2024-06-10", protocolSlug: "keto" });
    expect(res.status).toBe(201);
    planId = res.body.id || "mp-1";
  });

  it("STEP 12: User adds Monday breakfast to meal plan", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "prod-1" }] }));
    const res = await request(app).post(`/meal-plans/${planId}/entries`).send({
      dayOfWeek: "Mon", mealType: "breakfast",
      productId: "a0000000-0000-0000-0000-000000000001",
    });
    expect(res.status).toBe(201);
  });

  // ── Day 2: Shopping ──
  it("STEP 13: User creates shopping list", async () => {
    mockQuery.mockImplementationOnce(async () => ({
      rows: [{ id: "sl-1", user_id: "usr-journey-1", name: "Keto Week" }],
    }));
    const res = await request(app).post("/shopping/lists").send({ name: "Keto Week" });
    expect(res.status).toBe(201);
    listId = res.body.id || "sl-1";
  });

  it("STEP 14: User adds items to shopping list", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "prod-1" }] }));
    const res = await request(app).post(`/shopping/lists/${listId}/items`).send({ productId });
    expect(res.status).toBe(201);
  });

  it("STEP 15: User views shopping list with compliance badges", async () => {
    mockQuery
      .mockImplementationOnce(async () => ({ rows: [{ id: listId, name: "Keto Week" }] }))
      .mockImplementationOnce(async () => ({ rows: [] }));
    const res = await request(app).get(`/shopping/lists/${listId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Keto Week");
  });

  // ── Day 3: Search & Affiliates ──
  it("STEP 16: User searches for products", async () => {
    // Override index to return a mock with search pre-configured
    (meiliClient as any).index = jest.fn(() => ({
      search: jest.fn().mockResolvedValue({
        hits: [{ id: productId, name: "Keto Almond Cookies", brand: "KetoDelight" }],
        estimatedTotalHits: 1, query: "almond cookies", processingTimeMs: 5, limit: 20, offset: 0,
      }),
      updateSettings: jest.fn(),
    }));
    const res = await request(app).get("/search/products?q=almond+cookies&protocol=keto");
    expect(res.status).toBe(200);
  });

  it("STEP 17: User clicks affiliate link to buy product", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "ret-1" }] }));
    const res = await request(app).post("/clicks").send({
      productId, retailerId: "b0000000-0000-0000-0000-000000000001",
      redirectUrl: "https://iherb.com/product/keto-cookies",
    });
    expect(res.status).toBe(201);
    expect(res.body.redirectUrl).toContain("iherb.com");
  });

  // ── Day 4: Privacy & Account ──
  it("STEP 18: User exports their data (GDPR)", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).get("/gdpr/export");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("scans");
    expect(res.body).toHaveProperty("mealJournal");
  });

  it("STEP 19: User reads privacy policy", async () => {
    const res = await request(app).get("/gdpr/privacy");
    expect(res.status).toBe(200);
    expect(typeof res.body.policy).toBe("string");
  });

  it("STEP 20: User deletes their account (cascade all data)", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).delete("/gdpr/account");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("deleted");
  });

  // ── Edge cases ──
  it("EDGE: Scan with empty ingredients returns 400", async () => {
    const res = await request(app).post("/scans/ingredients").send({ protocolSlug: "keto" });
    expect(res.status).toBe(400);
  });

  it("EDGE: Unknown barcode returns 404", async () => {
    const { lookupBarcode } = require("../src/lib/off");
    lookupBarcode.mockResolvedValueOnce(null);
    const res = await request(app).post("/products/lookup").send({ barcode: "000000000000" });
    expect(res.status).toBe(404);
  });
});
