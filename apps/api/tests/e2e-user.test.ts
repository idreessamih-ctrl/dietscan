/// <reference types="jest" />

jest.mock("@sentry/node", () => ({ init: jest.fn(), setupExpressErrorHandler: jest.fn(), captureException: jest.fn() }));
jest.mock("supertokens-node", () => ({ init: jest.fn(), getAllCORSHeaders: jest.fn(() => []), getUser: jest.fn().mockResolvedValue(null), deleteUser: jest.fn().mockResolvedValue(undefined) }));
jest.mock("supertokens-node/recipe/session", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/emailpassword", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/session/framework/express", () => ({ verifySession: jest.fn(() => (req: any, res: any, next: any) => next()) }));
jest.mock("supertokens-node/framework/express", () => ({ middleware: jest.fn(() => (req: any, res: any, next: any) => next()), errorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)) }));
jest.mock("ioredis", () => jest.fn(() => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue("OK"), on: jest.fn() })));
jest.mock("../src/lib/off", () => ({ lookupBarcode: jest.fn().mockResolvedValue(null) }));

const mockQuery = jest.fn();
jest.mock("../src/lib/db", () => ({ query: mockQuery, pool: {}, db: {} }));

jest.mock("../src/middleware/auth", () => ({
  verifySession: (req: any, res: any, next: any) => next(),
  optionalSession: (req: any, res: any, next: any) => next(),
  resolveUser: (req: any, res: any, next: any) => { req.dbUser = { id: "u1", email: "e2e@test.com", dietary_protocol: "keto", created_at: new Date() }; next(); },
}));

import request from "supertest";
import app from "../src/index";

// Shared: mock DB returns for rules engine
beforeEach(() => {
  mockQuery.mockClear();
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("dietary_protocols")) return { rows: [{ slug: "keto", rules_json: { banned_ingredients: [], banned_categories: [], allowed_exceptions: [] } }] };
    if (sql.includes("ingredients") && !sql.includes("ingredient_aliases")) return { rows: [] };
    if (sql.includes("ingredient_aliases")) return { rows: [] };
    if (sql.includes("exclusion_list")) return { rows: [] };
    return { rows: [] };
  });
});

// ═══════════════════════════════════════════════════
//  E2E USER — Journal, Nutrition, Shopping, Meal Plans
// ═══════════════════════════════════════════════════

describe("JOURNAL", () => {
  const entryId = "a0000000-0000-0000-0000-000000000001";

  it("POST /journal → 201 create entry", async () => {
    mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes("INSERT INTO meal_journal")) {
        return { rows: [{ id: entryId, userId: "u1", mealType: params![1], scannedAt: new Date().toISOString(), complianceScore: 95 }] };
      }
      return { rows: [] };
    });
    const res = await request(app).post("/journal").send({ mealType: "breakfast", complianceScore: 95 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("userId");
  });

  it("GET /journal → 200 list entries", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT")) return { rows: [{ id: entryId, userId: "u1", mealType: "breakfast", scannedAt: new Date().toISOString(), complianceScore: 95 }] };
      return { rows: [] };
    });
    const res = await request(app).get("/journal");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /journal/summary → 200", async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ totalMeals: 10, averageCompliance: 87.5, breakfastCount: 3, lunchCount: 3, dinnerCount: 3, snackCount: 1 }],
    }));
    const res = await request(app).get("/journal/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalMeals");
    expect(res.body).toHaveProperty("averageCompliance");
    expect(res.body).toHaveProperty("mealTypeBreakdown");
  });

  it("DELETE /journal/:id → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: entryId }], rowCount: 1 }));
    const res = await request(app).delete(`/journal/${entryId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("DELETE /journal/:id → 404 not found", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    const res = await request(app).delete("/journal/nonexistent-id");
    expect(res.status).toBe(404);
  });
});

describe("NUTRITION", () => {
  it("GET /nutrition/daily → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).get("/nutrition/daily");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("date");
    expect(res.body).toHaveProperty("summary");
    expect(res.body).toHaveProperty("targets");
    expect(res.body).toHaveProperty("items");
  });

  it("GET /nutrition/daily?date=2024-01-15 → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).get("/nutrition/daily?date=2024-01-15");
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2024-01-15");
  });

  it("GET /nutrition/daily?date=bad → 400", async () => {
    const res = await request(app).get("/nutrition/daily?date=not-a-date");
    expect(res.status).toBe(400);
  });

  it("GET /nutrition/weekly → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).get("/nutrition/weekly");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("dailyData");
    expect(res.body).toHaveProperty("streak");
    expect(res.body).toHaveProperty("averageCompliance");
    expect(res.body.dailyData).toHaveLength(7);
  });
});

describe("SHOPPING LISTS", () => {
  const listId = "b0000000-0000-0000-0000-000000000001";
  const itemId = "c0000000-0000-0000-0000-000000000001";

  it("POST /shopping/lists → 201", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: listId, user_id: "u1", name: "Keto Shopping" }] }));
    const res = await request(app).post("/shopping/lists").send({ name: "Keto Shopping" });
    expect(res.status).toBe(201);
  });

  it("GET /shopping/lists → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: listId, user_id: "u1", name: "Keto Shopping" }] }));
    const res = await request(app).get("/shopping/lists");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /shopping/lists/:id → 200 with items", async () => {
    let call = 0;
    mockQuery.mockImplementation(async (sql: string) => {
      call++;
      if (call === 1) return { rows: [{ id: listId, name: "Keto Shopping" }] };
      return { rows: [] };
    });
    const res = await request(app).get(`/shopping/lists/${listId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
  });

  it("POST /shopping/lists/:id/items → 201", async () => {
    let call = 0;
    mockQuery.mockImplementation(async (sql: string) => {
      call++;
      if (call === 1) return { rows: [{ id: listId }] };
      if (call === 2) return { rows: [{ id: "prod-1" }] };
      return { rows: [{ id: itemId, list_id: listId, product_id: "prod-1", checked: false }] };
    });
    const res = await request(app).post(`/shopping/lists/${listId}/items`).send({ productId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(201);
  });

  it("PATCH /shopping/lists/:id/items/:itemId → 200", async () => {
    let call = 0;
    mockQuery.mockImplementation(async () => {
      call++;
      if (call === 1) return { rows: [{ id: listId }] };
      return { rows: [{ id: itemId, checked: true }] };
    });
    const res = await request(app).patch(`/shopping/lists/${listId}/items/${itemId}`).send({ checked: true });
    expect(res.status).toBe(200);
  });

  it("DELETE /shopping/lists/:id/items/:itemId → 200", async () => {
    let call = 0;
    mockQuery.mockImplementation(async () => {
      call++;
      if (call === 1) return { rows: [{ id: listId }] };
      return { rows: [{ id: itemId }] };
    });
    const res = await request(app).delete(`/shopping/lists/${listId}/items/${itemId}`);
    expect(res.status).toBe(200);
  });

  it("DELETE /shopping/lists/:id → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: listId }] }));
    const res = await request(app).delete(`/shopping/lists/${listId}`);
    expect(res.status).toBe(200);
  });
});

describe("MEAL PLANS", () => {
  const planId = "d0000000-0000-0000-0000-000000000001";
  const entryId = "e0000000-0000-0000-0000-000000000001";

  it("POST /meal-plans → 201", async () => {
    let call = 0;
    mockQuery.mockImplementation(async (sql: string) => {
      call++;
      if (call === 1) return { rows: [{ slug: "keto" }] };
      return { rows: [{ id: planId, user_id: "u1", weekStart: "2024-01-01", protocolSlug: "keto" }] };
    });
    const res = await request(app).post("/meal-plans").send({ weekStart: "2024-01-01", protocolSlug: "keto" });
    expect(res.status).toBe(201);
  });

  it("POST /meal-plans → 400 bad protocol", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).post("/meal-plans").send({ weekStart: "2024-01-01", protocolSlug: "nonexistent" });
    expect(res.status).toBe(400);
  });

  it("GET /meal-plans → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).get("/meal-plans");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /meal-plans/:id → 200", async () => {
    let call = 0;
    mockQuery.mockImplementation(async () => {
      call++;
      if (call === 1) return { rows: [{ id: planId, weekStart: "2024-01-01", protocolSlug: "keto" }] };
      return { rows: [] };
    });
    const res = await request(app).get(`/meal-plans/${planId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("entries");
  });

  it("POST /meal-plans/:id/entries → 201", async () => {
    let call = 0;
    mockQuery.mockImplementation(async () => {
      call++;
      if (call === 1) return { rows: [{ id: planId }] };
      if (call === 2) return { rows: [{ id: "prod-1" }] };
      return { rows: [{ id: entryId, mealPlanId: planId, dayOfWeek: "Monday", mealType: "breakfast", productId: "prod-1" }] };
    });
    const res = await request(app).post(`/meal-plans/${planId}/entries`).send({ dayOfWeek: "Monday", mealType: "breakfast", productId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(201);
  });

  it("DELETE /meal-plans/:id/entries/:entryId → 200", async () => {
    let call = 0;
    mockQuery.mockImplementation(async () => {
      call++;
      if (call === 1) return { rows: [{ id: planId }] };
      return { rows: [{ id: entryId }] };
    });
    const res = await request(app).delete(`/meal-plans/${planId}/entries/${entryId}`);
    expect(res.status).toBe(200);
  });
});
