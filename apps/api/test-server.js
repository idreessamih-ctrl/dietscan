/**
 * Test server: starts Express with mocked external dependencies.
 * Uses plain Node.js require() — no tsx, no ESM issues.
 * Same mock strategy as __tests__/setup.ts and e2e-journey.test.ts
 */
process.env.NODE_ENV = "test";

// ── Mocks (must be before any imports) ──
const Module = require("module");
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  // Mock external deps that crash or need backing services
  if (id === "@sentry/node") {
    return { init: () => {}, setupExpressErrorHandler: () => {}, captureException: () => {} };
  }
  if (id === "supertokens-node") {
    return { init: () => {}, getAllCORSHeaders: () => [], getUser: async () => ({ emails: ["test@server.com"] }), deleteUser: async () => {} };
  }
  if (id === "supertokens-node/recipe/session") {
    return { default: { init: () => ({}) } };
  }
  if (id === "supertokens-node/recipe/emailpassword") {
    return { default: { init: () => ({}) } };
  }
  if (id === "supertokens-node/framework/express") {
    return {
      middleware: () => (req, res, next) => next(),
      errorHandler: () => (err, req, res, next) => next(err),
    };
  }
  if (id === "ioredis") {
    return function () { return { get: async () => null, set: async () => "OK", setex: async () => "OK", incr: async () => 1, expire: async () => 1, on: () => {} }; };
  }
  if (id.includes("meilisearch")) {
    return {
      meiliClient: { index: () => ({ search: async () => ({ hits: [], estimatedTotalHits: 0 }), updateSettings: async () => {} }), health: async () => ({ status: "available" }) },
      initMeilisearch: async () => {},
    };
  }
  if (id.includes("@openfoodfacts")) {
    return {
      OpenFoodFacts: function () {
        return {
          getProductV3: async () => ({
            data: { status: "success", product: { product_name: "Test Product", brands: "TestBrand", ingredients_text: "water, salt" } },
          }),
        };
      },
    };
  }
  // Mock Postgres — all CRUD operations return empty/default rows
  if (id === "pg" || id.endsWith("/lib/db")) {
    const mockQuery = async (sql, params) => {
      const sqlLower = (sql || "").toLowerCase();
      // Protocol rules lookup
      if (sqlLower.includes("dietary_protocols") && sqlLower.includes("slug")) {
        return { rows: [{ slug: "keto", rules_json: { banned_ingredients: ["sugar"], banned_categories: ["grains"], allowed_exceptions: ["stevia"] } }] };
      }
      // Ingredients table
      if (sqlLower.includes("from ingredients") && !sqlLower.includes("aliases")) {
        return { rows: [{ id: "ing-1", name: "sugar", category: "sugars", banned_by: [] }, { id: "ing-2", name: "stevia", category: "sweeteners", banned_by: [] }] };
      }
      // Ingredient aliases
      if (sqlLower.includes("ingredient_aliases") || sqlLower.includes("exclusion_list")) {
        return { rows: [] };
      }
      // INSERT returning
      if (sqlLower.includes("returning")) {
        return { rows: [{ id: "mock-" + Math.random().toString(36).slice(2, 10) }], rowCount: 1 };
      }
      // SELECT with rows
      if (sqlLower.includes("select")) {
        return { rows: [], rowCount: 0 };
      }
      // Default
      return { rows: [], rowCount: 0 };
    };
    return { query: mockQuery, Pool: function() { return { query: mockQuery, connect: async () => ({ query: mockQuery, release: () => {} }) }; } };
  }
  // Mock Valkey (ioredis-based cache module)
  if (id.includes("valkey")) {
    return {
      valkey: { get: async () => null, set: async () => "OK", setex: async () => "OK", incr: async () => 1, expire: async () => 1, on: () => {} },
    };
  }
  if (id.includes("./middleware/auth")) {
    const sessionMock = { getUserId: () => "usr-server-1", revokeSession: async () => {} };
    return {
      verifySession: (req, res, next) => { req.session = sessionMock; next(); },
      optionalSession: (req, res, next) => { req.session = sessionMock; next(); },
      resolveUser: (req, res, next) => { req.dbUser = { id: "usr-server-1", email: "test@server.com", dietary_protocol: "keto" }; next(); },
    };
  }
  return originalRequire.apply(this, arguments);
};

// Now import the app safely
const app = require("./src/index").default || require("./src/index");

const PORT = process.env.PORT || 3999;
app.listen(PORT, () => {
  console.log(`SERVER_READY port=${PORT} pid=${process.pid}`);
});

// Keep alive
process.stdin.resume();
