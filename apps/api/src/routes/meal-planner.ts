import { Router, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { query } from "../lib/db";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";
import { evaluateIngredients } from "../rules/engine";

const router = Router();

const createMealPlanSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in YYYY-MM-DD format"),
  protocolSlug: z.string().min(1),
});

const addEntrySchema = z.object({
  dayOfWeek: z.enum([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  productId: z.string().uuid(),
});

// Normalize short day names to full names
function normalizeDayOfWeek(day: string): string {
  switch (day) {
    case "Mon":
      return "Monday";
    case "Tue":
      return "Tuesday";
    case "Wed":
      return "Wednesday";
    case "Thu":
      return "Thursday";
    case "Fri":
      return "Friday";
    case "Sat":
      return "Saturday";
    case "Sun":
      return "Sunday";
    default:
      return day;
  }
}

// POST /meal-plans - create weekly plan
router.post(
  "/",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const parsed = createMealPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { weekStart, protocolSlug } = parsed.data;

      // Validate protocol slug exists
      const protocolRes = await query("SELECT slug FROM dietary_protocols WHERE slug = $1", [protocolSlug]);
      if (protocolRes.rows.length === 0) {
        res.status(400).json({ message: "Dietary protocol not found" });
        return;
      }

      const result = await query<{ id: string; user_id: string; week_start: string; protocol_slug: string }>(
        `INSERT INTO meal_plans (user_id, week_start, protocol_slug)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, week_start as "weekStart", protocol_slug as "protocolSlug"`,
        [userId, weekStart, protocolSlug]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// GET /meal-plans - user's plans
router.get(
  "/",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const result = await query<{ id: string; user_id: string; week_start: string; protocol_slug: string }>(
        `SELECT id, user_id, week_start as "weekStart", protocol_slug as "protocolSlug"
         FROM meal_plans
         WHERE user_id = $1
         ORDER BY week_start DESC`,
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// GET /meal-plans/:id - single plan with entries
router.get(
  "/:id",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const planId = req.params.id;

      // Ensure plan belongs to user
      const planRes = await query<{ id: string; week_start: string; protocol_slug: string }>(
        `SELECT id, week_start as "weekStart", protocol_slug as "protocolSlug"
         FROM meal_plans
         WHERE id = $1 AND user_id = $2`,
        [planId, userId]
      );

      if (planRes.rows.length === 0) {
        res.status(404).json({ message: "Meal plan not found" });
        return;
      }

      const plan = planRes.rows[0];

      // Retrieve plan entries with product information
      interface RawEntryRow {
        id: string;
        dayOfWeek: string;
        mealType: "breakfast" | "lunch" | "dinner" | "snack";
        productId: string;
        productName: string;
        productBrand: string | null;
        ingredientsJson: unknown;
        nutritionJson: unknown;
      }

      const entriesRes = await query<RawEntryRow>(
        `SELECT mpe.id, mpe.day_of_week as "dayOfWeek", mpe.meal_type as "mealType", mpe.product_id as "productId",
                p.name as "productName", p.brand as "productBrand", p.ingredients_json as "ingredientsJson", p.nutrition_json as "nutritionJson"
         FROM meal_plan_entries mpe
         JOIN products p ON mpe.product_id = p.id
         WHERE mpe.meal_plan_id = $1`,
        [planId]
      );

      const entries = entriesRes.rows.map((row) => {
        let ingredients: string[] = [];
        try {
          if (typeof row.ingredientsJson === "string") {
            ingredients = JSON.parse(row.ingredientsJson) as string[];
          } else if (Array.isArray(row.ingredientsJson)) {
            ingredients = row.ingredientsJson as string[];
          }
        } catch {
          ingredients = [];
        }

        let nutrition: Record<string, unknown> = {};
        try {
          if (typeof row.nutritionJson === "string") {
            nutrition = JSON.parse(row.nutritionJson) as Record<string, unknown>;
          } else if (row.nutritionJson && typeof row.nutritionJson === "object") {
            nutrition = row.nutritionJson as Record<string, unknown>;
          }
        } catch {
          nutrition = {};
        }

        return {
          id: row.id,
          dayOfWeek: normalizeDayOfWeek(row.dayOfWeek),
          mealType: row.mealType,
          productId: row.productId,
          name: row.productName,
          brand: row.productBrand,
          ingredients,
          nutrition,
        };
      });

      res.json({
        ...plan,
        entries,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /meal-plans/:id/entries - add meal to day/slot
router.post(
  "/:id/entries",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const planId = req.params.id;

      // Ensure plan belongs to user
      const planRes = await query(
        "SELECT id FROM meal_plans WHERE id = $1 AND user_id = $2",
        [planId, userId]
      );

      if (planRes.rows.length === 0) {
        res.status(404).json({ message: "Meal plan not found" });
        return;
      }

      const parsed = addEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { dayOfWeek, mealType, productId } = parsed.data;
      const normalizedDay = normalizeDayOfWeek(dayOfWeek);

      // Ensure product exists
      const productRes = await query("SELECT id FROM products WHERE id = $1", [productId]);
      if (productRes.rows.length === 0) {
        res.status(400).json({ message: "Product not found" });
        return;
      }

      const result = await query<{ id: string; meal_plan_id: string; day_of_week: string; meal_type: string; product_id: string }>(
        `INSERT INTO meal_plan_entries (user_id, meal_plan_id, day_of_week, meal_type, product_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, meal_plan_id as "mealPlanId", day_of_week as "dayOfWeek", meal_type as "mealType", product_id as "productId"`,
        [userId, planId, normalizedDay, mealType, productId]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /meal-plans/:id/entries/:entryId - remove meal entry
router.delete(
  "/:id/entries/:entryId",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { id: planId, entryId } = req.params;

      // Ensure plan belongs to user
      const planRes = await query(
        "SELECT id FROM meal_plans WHERE id = $1 AND user_id = $2",
        [planId, userId]
      );

      if (planRes.rows.length === 0) {
        res.status(404).json({ message: "Meal plan not found" });
        return;
      }

      const result = await query(
        "DELETE FROM meal_plan_entries WHERE id = $1 AND meal_plan_id = $2 RETURNING id",
        [entryId, planId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Meal plan entry not found" });
        return;
      }

      res.json({ message: "Meal plan entry removed successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// GET /meal-plans/:id/compliance - calculate compliance forecast
router.get(
  "/:id/compliance",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const planId = req.params.id;

      // Ensure plan belongs to user
      const planRes = await query<{ protocol_slug: string }>(
        "SELECT protocol_slug FROM meal_plans WHERE id = $1 AND user_id = $2",
        [planId, userId]
      );

      if (planRes.rows.length === 0) {
        res.status(404).json({ message: "Meal plan not found" });
        return;
      }

      const protocolSlug = planRes.rows[0].protocol_slug;

      // Get all entries with their product ingredients
      interface RawEntryIngs {
        dayOfWeek: string;
        ingredientsJson: unknown;
      }

      const entriesRes = await query<RawEntryIngs>(
        `SELECT mpe.day_of_week as "dayOfWeek", p.ingredients_json as "ingredientsJson"
         FROM meal_plan_entries mpe
         JOIN products p ON mpe.product_id = p.id
         WHERE mpe.meal_plan_id = $1`,
        [planId]
      );

      // Group ingredients by day
      const dayIngredientsMap = new Map<string, string[]>();
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      for (const d of days) {
        dayIngredientsMap.set(d, []);
      }

      for (const row of entriesRes.rows) {
        const normDay = normalizeDayOfWeek(row.dayOfWeek);
        if (dayIngredientsMap.has(normDay)) {
          let ingredients: string[] = [];
          try {
            if (typeof row.ingredientsJson === "string") {
              ingredients = JSON.parse(row.ingredientsJson) as string[];
            } else if (Array.isArray(row.ingredientsJson)) {
              ingredients = row.ingredientsJson as string[];
            }
          } catch {
            ingredients = [];
          }

          const existing = dayIngredientsMap.get(normDay) || [];
          dayIngredientsMap.set(normDay, [...existing, ...ingredients]);
        }
      }

      // Calculate compliance per day
      const dayReports: Record<
        string,
        {
          score: number;
          status: "green" | "yellow" | "red" | "gray";
          violationsCount: number;
        }
      > = {};

      for (const d of days) {
        const ingredients = Array.from(new Set(dayIngredientsMap.get(d) || []));
        if (ingredients.length === 0) {
          dayReports[d] = {
            score: 100,
            status: "gray", // Gray if no meals planned for that day
            violationsCount: 0,
          };
        } else {
          const report = await evaluateIngredients(protocolSlug, ingredients);
          let status: "green" | "yellow" | "red" = "green";
          if (report.score === 100) {
            status = "green";
          } else if (report.score > 0) {
            status = "yellow";
          } else {
            status = "red";
          }

          dayReports[d] = {
            score: report.score,
            status,
            violationsCount: report.violations.length,
          };
        }
      }

      res.json({
        protocolSlug,
        days: dayReports,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
