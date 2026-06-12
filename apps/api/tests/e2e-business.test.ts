/// <reference types="jest" />

jest.mock("@sentry/node", () => ({ init: jest.fn(), setupExpressErrorHandler: jest.fn(), captureException: jest.fn() }));
jest.mock("supertokens-node", () => ({ init: jest.fn(), getAllCORSHeaders: jest.fn(() => []), getUser: jest.fn().mockResolvedValue({ emails: ["e2e@test.com"] }), deleteUser: jest.fn().mockResolvedValue(undefined) }));
jest.mock("supertokens-node/recipe/session", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/emailpassword", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/session/framework/express", () => ({ verifySession: jest.fn(() => (req: any, res: any, next: any) => next()) }));
jest.mock("supertokens-node/framework/express", () => ({ middleware: jest.fn(() => (req: any, res: any, next: any) => next()), errorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)) }));
jest.mock("ioredis", () => jest.fn(() => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue("OK"), on: jest.fn() })));
jest.mock("../src/lib/meilisearch", () => ({ meiliClient: { index: jest.fn(() => ({ search: jest.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0, query: "", processingTimeMs: 1, limit: 20, offset: 0 }), updateSettings: jest.fn() })), health: jest.fn().mockResolvedValue({ status: "available" }) }, initMeilisearch: jest.fn() }));

const mockQuery = jest.fn();
jest.mock("../src/lib/db", () => ({ query: mockQuery, pool: {}, db: {} }));

// Simulate a full session mock with revokeSession
const mockSession = { getUserId: () => "u1", revokeSession: jest.fn().mockResolvedValue(undefined) };
jest.mock("../src/middleware/auth", () => ({
  verifySession: (req: any, res: any, next: any) => { req.session = mockSession; next(); },
  optionalSession: (req: any, res: any, next: any) => { req.session = mockSession; next(); },
  resolveUser: (req: any, res: any, next: any) => { req.dbUser = { id: "u1", email: "e2e@test.com", dietary_protocol: "keto", created_at: new Date() }; next(); },
}));

import request from "supertest";
import app from "../src/index";

beforeEach(() => { mockQuery.mockClear(); mockSession.revokeSession.mockClear(); });

// ═══════════════════════════════════════════════════
//  E2E BUSINESS — Affiliates, Sync, Notifications, GDPR
// ═══════════════════════════════════════════════════

describe("AFFILIATES (Clicks + Postback)", () => {
  it("POST /clicks → 201 create click with redirect URL", async () => {
    let call = 0;
    mockQuery.mockImplementation(async () => { call++; if (call <= 2) return { rows: [{ id: "x" }] }; return { rows: [] }; });
    const res = await request(app).post("/clicks").send({
      productId: "a0000000-0000-0000-0000-000000000001",
      retailerId: "b0000000-0000-0000-0000-000000000001",
      redirectUrl: "https://iherb.com/product/test",
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("clickId");
    expect(res.body).toHaveProperty("redirectUrl");
    expect(res.body.redirectUrl).toContain("clickId=");
  });

  it("POST /clicks → 400 missing fields", async () => {
    const res = await request(app).post("/clicks").send({});
    expect(res.status).toBe(400);
  });

  it("GET /postback → 400 missing params", async () => {
    const res = await request(app).get("/postback");
    expect(res.status).toBe(400);
  });

  it("GET /postback → 200 record conversion", async () => {
    let call = 0;
    mockQuery.mockImplementation(async () => {
      call++;
      if (call === 1) return { rows: [{ click_id: "click-1" }] };
      if (call === 2) return { rows: [] };
      return { rows: [] };
    });
    const res = await request(app).get("/postback?click_id=click-1&order_id=ord-1&amount=29.99&commission=2.99");
    expect(res.status).toBe(200);
  });

  it("GET /postback → 409 duplicate conversion", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("affiliate_clicks")) return { rows: [{ click_id: "click-2" }] };
      if (sql.includes("affiliate_conversions")) return { rows: [{ id: "existing" }] };
      return { rows: [] };
    });
    const res = await request(app).get("/postback?click_id=click-2&order_id=ord-2&amount=10.00&commission=1.00");
    expect(res.status).toBe(409);
  });
});

describe("SYNC", () => {
  it("GET /api/v1/sync/products → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "p1", barcode: "001", name: "Test", brand: "Brand", ingredients_json: [], nutrition_json: {}, updated_at: new Date() }] }));
    const res = await request(app).get("/api/v1/sync/products?since=2020-01-01&limit=10&offset=0");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("products");
    expect(res.body).toHaveProperty("hasMore");
  });

  it("GET /api/v1/sync/protocols → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "pr1", slug: "keto", name: "Keto", rules_json: {}, updated_at: new Date() }] }));
    const res = await request(app).get("/api/v1/sync/protocols");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("protocols");
  });

  it("GET /api/v1/sync/ingredients → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "i1", name: "sugar", category: "sugars", banned_by: [], aliases: [], updated_at: new Date() }] }));
    const res = await request(app).get("/api/v1/sync/ingredients");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ingredients");
  });

  it("GET /api/v1/sync/articles → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "a1", slug: "keto-101", title: "Keto 101", content: "...", protocol_tags: ["keto"], updated_at: new Date() }] }));
    const res = await request(app).get("/api/v1/sync/articles");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("articles");
  });

  it("POST /api/v1/sync/scans → 200 (offline upload)", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).post("/api/v1/sync/scans").send([{
      id: "a0000000-0000-0000-0000-000000000001",
      product_id: "b0000000-0000-0000-0000-000000000001",
      protocol_slug: "keto",
      passed: true,
      violations_json: "[]",
      scanned_at: new Date().toISOString(),
      product: { id: "b0000000-0000-0000-0000-000000000001", barcode: "001", name: "Test", brand: "Brand", ingredients_json: ["salt"], nutrition_json: {} },
    }]);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("synced");
  });

  it("POST /api/v1/sync/journal → 200 (offline upload)", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).post("/api/v1/sync/journal").send([{
      id: "c0000000-0000-0000-0000-000000000001",
      meal_type: "breakfast",
      compliance_score: 95,
      created_at: new Date().toISOString(),
    }]);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("synced");
  });
});

describe("NOTIFICATIONS", () => {
  it("POST /notifications/register → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).post("/notifications/register").send({ token: "ExponentPushToken[xxx]" });
    expect(res.status).toBe(200);
  });

  it("POST /notifications/send → 403 without admin key", async () => {
    const res = await request(app).post("/notifications/send").send({ userId: "u1", title: "Test", body: "Body" });
    expect(res.status).toBe(403);
  });

  it("POST /notifications/send → 200 with admin key", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ push_token: "ExponentPushToken[yyy]" }] }));
    const res = await request(app).post("/notifications/send")
      .set("x-admin-api-key", "admin-secret")
      .send({ userId: "00000000-0000-0000-0000-000000000001", title: "Test", body: "Hello" });
    expect(res.status).toBe(200);
  });
});

describe("GDPR", () => {
  it("GET /gdpr/export → 200 with user data JSON", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [{ id: "u1", email: "e2e@test.com" }] }));
    const res = await request(app).get("/gdpr/export");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("mealJournal");
    expect(res.body).toHaveProperty("scans");
  });

  it("GET /gdpr/privacy → 200 with policy text", async () => {
    const res = await request(app).get("/gdpr/privacy");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("policy");
  });

  it("DELETE /gdpr/account → 200", async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    const res = await request(app).delete("/gdpr/account");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("deleted");
  });
});

describe("AUTH", () => {
  it("GET /api/auth/session-test → 200", async () => {
    const res = await request(app).get("/api/auth/session-test");
    expect(res.status).toBe(200);
  });
});
