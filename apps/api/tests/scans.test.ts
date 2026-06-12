import request from "supertest";
import { Request, Response, NextFunction } from "express";

jest.mock("../src/lib/off", () => ({
  lookupBarcode: jest.fn().mockResolvedValue(null),
}));

import app from "../src/index";
import { query } from "../src/lib/db";
import { CustomRequest } from "../src/middleware/auth";

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => {
    return {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      on: jest.fn(),
    };
  });
});

jest.mock("../src/lib/db", () => ({
  query: jest.fn().mockImplementation(() => Promise.resolve({ rows: [] })),
}));

jest.mock("../src/middleware/auth", () => ({
  verifySession: (req: Request, res: Response, next: NextFunction) => next(),
  optionalSession: (req: Request, res: Response, next: NextFunction) => next(),
  resolveUser: (req: CustomRequest, res: Response, next: NextFunction) => {
    req.dbUser = {
      id: "test-user-id",
      email: "test@example.com",
      dietary_protocol: null,
      created_at: new Date(),
    };
    next();
  },
}));

describe("POST /scans/ingredients", () => {
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
            { id: "milk_id", name: "milk", category: "dairy", banned_by: [] },
          ],
        };
      }
      if (sql.includes("ingredient_aliases")) {
        return { rows: [] };
      }
      if (sql.includes("exclusion_list")) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  it("should return a compliance report for a list of ingredients", async () => {
    const response = await request(app)
      .post("/scans/ingredients")
      .send({
        ingredients: ["sugar", "olive oil"],
        protocolSlug: "keto",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("passed");
    expect(response.body).toHaveProperty("score");
    expect(response.body.passed).toBe(false);
    expect(response.body.flaggedIngredients).toContain("sugar");
  });

  it("should return 400 if ingredients is missing or invalid", async () => {
    const response = await request(app)
      .post("/scans/ingredients")
      .send({
        protocolSlug: "keto",
      });

    expect(response.status).toBe(400);
  });
});
