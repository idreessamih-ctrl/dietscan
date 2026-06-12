/// <reference types="jest" />

// ── Global module mocks ──
jest.mock("@sentry/node", () => ({
  init: jest.fn(), setupExpressErrorHandler: jest.fn(), captureException: jest.fn(),
}));
jest.mock("supertokens-node", () => ({
  init: jest.fn(), getAllCORSHeaders: jest.fn(() => []),
  getUser: jest.fn().mockResolvedValue(null), deleteUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("supertokens-node/recipe/session", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/emailpassword", () => ({ default: { init: jest.fn(() => ({})) } }));
jest.mock("supertokens-node/recipe/session/framework/express", () => ({
  verifySession: jest.fn(() => (req: any, res: any, next: any) => next()),
}));
jest.mock("supertokens-node/framework/express", () => ({
  middleware: jest.fn(() => (req: any, res: any, next: any) => next()),
  errorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
}));
jest.mock("ioredis", () => jest.fn(() => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue("OK"), on: jest.fn() })));
jest.mock("../src/lib/off", () => ({ lookupBarcode: jest.fn().mockResolvedValue(null) }));

// ── Dynamic DB mock ──
const mockQuery = jest.fn();
jest.mock("../src/lib/db", () => ({ query: mockQuery, pool: {}, db: {} }));

// ── Auth bypass ──
jest.mock("../src/middleware/auth", () => ({
  verifySession: (req: any, res: any, next: any) => next(),
  optionalSession: (req: any, res: any, next: any) => next(),
  resolveUser: (req: any, res: any, next: any) => { req.dbUser = { id: "usr-1", email: "test@e2e.com", dietary_protocol: "keto", created_at: new Date() }; next(); },
}));

import request from "supertest";
import app from "../src/index";

// ═══════════════════════════════════════════════════
//  E2E CORE – Health, Products, Scans, Search
// ═══════════════════════════════════════════════════

// Shared mock helpers
function mockDB(pattern: string, rows: any[]) {
  mockQuery.mockImplementation(async (sql: string, _params?: any[]) => {
    if (sql.includes("dietary_protocols")) return { rows: [{ slug: "keto", rules_json: { banned_ingredients: ["sugar"], banned_categories: [], allowed_exceptions: [] } }] };
    if (sql.includes("ingredients")) return { rows: [{ id: "ing-1", name: "sugar", category: "sugars", banned_by: [] }] };
    if (sql.includes("ingredient_aliases")) return { rows: [] };
    if (sql.includes("exclusion_list")) return { rows: [] };
    if (sql.includes(pattern)) return { rows };
    return { rows: [] };
  });
}

describe("HEALTH", () => {
  it("GET /health → 200 ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("PRODUCTS", () => {
  it("POST /products/lookup → 400 if barcode missing", async () => {
    const res = await request(app).post("/products/lookup").send({});
    expect(res.status).toBe(400);
  });

  it("POST /products/lookup → 400 if barcode not string", async () => {
    const res = await request(app).post("/products/lookup").send({ barcode: 123 });
    expect(res.status).toBe(400);
  });

  it("POST /products/lookup → 404 if not found", async () => {
    const { lookupBarcode } = require("../src/lib/off");
    lookupBarcode.mockResolvedValueOnce(null);
    const res = await request(app).post("/products/lookup").send({ barcode: "000000000000" });
    expect(res.status).toBe(404);
  });

  it("POST /products/lookup → 200 with product data", async () => {
    const { lookupBarcode } = require("../src/lib/off");
    lookupBarcode.mockResolvedValueOnce({ code: "123", product: { product_name: "Test" } });
    const res = await request(app).post("/products/lookup").send({ barcode: "000000000001" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("code");
  });
});

describe("SCANS", () => {
  beforeEach(() => { mockQuery.mockClear(); mockDB("dietary_protocols", []); });

  it("POST /scans/ingredients → 400 if ingredients missing", async () => {
    const res = await request(app).post("/scans/ingredients").send({ protocolSlug: "keto" });
    expect(res.status).toBe(400);
  });

  it("POST /scans/ingredients → 200 with compliance report", async () => {
    const res = await request(app).post("/scans/ingredients").send({ ingredients: ["sugar", "olive oil"], protocolSlug: "keto" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("passed");
    expect(res.body).toHaveProperty("score");
    expect(res.body).toHaveProperty("violations");
    expect(res.body).toHaveProperty("compliantIngredients");
    expect(res.body).toHaveProperty("flaggedIngredients");
  });

  it("POST /scans → same as /scans/ingredients", async () => {
    const res = await request(app).post("/scans").send({ ingredients: ["spinach"], protocolSlug: "keto" });
    expect(res.status).toBe(200);
  });
});
