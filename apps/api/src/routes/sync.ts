import { Router, Request, Response, NextFunction } from "express";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";
import { query } from "../lib/db";
import { z } from "zod";

const router = Router();

// Zod schemas for inputs
const syncQuerySchema = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(100),
  offset: z.coerce.number().min(0).default(0),
});

const scanPushSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  protocol_slug: z.string(),
  passed: z.coerce.boolean(),
  violations_json: z.union([z.string(), z.array(z.any())]),
  scanned_at: z.string(),
  product: z.object({
    id: z.string().uuid(),
    barcode: z.string(),
    name: z.string(),
    brand: z.string().nullable().optional(),
    ingredients_json: z.union([z.string(), z.array(z.string())]),
    nutrition_json: z.any().nullable().optional(),
  }).optional(),
});

const journalPushSchema = z.object({
  id: z.string().uuid(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  compliance_score: z.coerce.number().min(0).max(100),
  created_at: z.string(),
});

// GET /api/v1/sync/products
router.get("/products", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { since, limit, offset } = syncQuerySchema.parse(req.query);
    const sinceTimestamp = since || new Date(0).toISOString();

    const dbResult = await query(
      `SELECT id, barcode, name, brand, ingredients_json, nutrition_json, updated_at
       FROM products
       WHERE updated_at > $1
       ORDER BY updated_at ASC
       LIMIT $2 OFFSET $3`,
      [sinceTimestamp, limit, offset]
    );

    res.json({
      products: dbResult.rows,
      hasMore: dbResult.rows.length === limit,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/sync/protocols
router.get("/protocols", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { since } = syncQuerySchema.parse(req.query);
    const sinceTimestamp = since || new Date(0).toISOString();

    const dbResult = await query(
      `SELECT id, slug, name, description, rules_json, updated_at
       FROM dietary_protocols
       WHERE updated_at > $1
       ORDER BY updated_at ASC`,
      [sinceTimestamp]
    );

    res.json({
      protocols: dbResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/sync/ingredients
router.get("/ingredients", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { since } = syncQuerySchema.parse(req.query);
    const sinceTimestamp = since || new Date(0).toISOString();

    const dbResult = await query(
      `SELECT i.id, i.name, i.category, i.banned_by, i.updated_at,
              COALESCE(json_agg(a.alias) FILTER (WHERE a.alias IS NOT NULL), '[]'::json) as aliases
       FROM ingredients i
       LEFT JOIN ingredient_aliases a ON i.id = a.ingredient_id
       WHERE i.updated_at > $1
       GROUP BY i.id
       ORDER BY i.updated_at ASC`,
      [sinceTimestamp]
    );

    res.json({
      ingredients: dbResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/sync/articles
router.get("/articles", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { since } = syncQuerySchema.parse(req.query);
    const sinceTimestamp = since || new Date(0).toISOString();

    const dbResult = await query(
      `SELECT id, slug, title, content, protocol_tags, updated_at
       FROM education_articles
       WHERE updated_at > $1
       ORDER BY updated_at ASC`,
      [sinceTimestamp]
    );

    res.json({
      articles: dbResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sync/scans
router.post(
  "/scans",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.dbUser;
      if (!user) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const bodyParsed = z.array(scanPushSchema).safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({
          message: "Invalid sync scans payload",
          errors: bodyParsed.error.errors,
        });
        return;
      }

      const scansList = bodyParsed.data;
      const errors: any[] = [];
      let syncedCount = 0;

      for (const scan of scansList) {
        try {
          // 1. If product info is provided, ensure it exists in products table
          if (scan.product) {
            const ingredientsStr = typeof scan.product.ingredients_json === "string"
              ? scan.product.ingredients_json
              : JSON.stringify(scan.product.ingredients_json);

            const nutritionStr = scan.product.nutrition_json
              ? (typeof scan.product.nutrition_json === "string" ? scan.product.nutrition_json : JSON.stringify(scan.product.nutrition_json))
              : "{}";

            await query(
              `INSERT INTO products (id, barcode, name, brand, ingredients_json, nutrition_json)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO UPDATE SET
                 barcode = EXCLUDED.barcode,
                 name = EXCLUDED.name,
                 brand = EXCLUDED.brand,
                 ingredients_json = EXCLUDED.ingredients_json,
                 nutrition_json = EXCLUDED.nutrition_json`,
              [
                scan.product.id,
                scan.product.barcode,
                scan.product.name,
                scan.product.brand || null,
                ingredientsStr,
                nutritionStr,
              ]
            );
          } else {
            // Ensure referenced product exists (e.g. check or insert dummy)
            const checkProduct = await query("SELECT id FROM products WHERE id = $1", [scan.product_id]);
            if (checkProduct.rows.length === 0) {
              // Create a fallback product to satisfy foreign key constraints
              await query(
                `INSERT INTO products (id, barcode, name, brand, ingredients_json, nutrition_json)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [
                  scan.product_id,
                  `dummy-${scan.product_id}`,
                  "Unknown Offline Product",
                  null,
                  "[]",
                  "{}",
                ]
              );
            }
          }

          // 2. Ensure referenced protocol exists
          const checkProtocol = await query("SELECT slug FROM dietary_protocols WHERE slug = $1", [scan.protocol_slug]);
          if (checkProtocol.rows.length === 0) {
            // Create fallback protocol if it doesn't exist
            await query(
              `INSERT INTO dietary_protocols (slug, name, rules_json)
               VALUES ($1, $2, $3)
               ON CONFLICT (slug) DO NOTHING`,
              [scan.protocol_slug, scan.protocol_slug, "{}"]
            );
          }

          // 3. Upsert Scan
          const violationsStr = typeof scan.violations_json === "string"
            ? scan.violations_json
            : JSON.stringify(scan.violations_json);

          await query(
            `INSERT INTO scans (id, user_id, product_id, protocol_slug, passed, violations, scanned_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               passed = EXCLUDED.passed,
               violations = EXCLUDED.violations,
               scanned_at = EXCLUDED.scanned_at`,
            [
              scan.id,
              user.id,
              scan.product_id,
              scan.protocol_slug,
              scan.passed,
              violationsStr,
              scan.scanned_at,
            ]
          );

          syncedCount++;
        } catch (err: any) {
          console.error(`Failed syncing scan ${scan.id}:`, err);
          errors.push({ id: scan.id, error: err.message });
        }
      }

      res.json({
        synced: syncedCount,
        errors,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/sync/journal
router.post(
  "/journal",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.dbUser;
      if (!user) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const bodyParsed = z.array(journalPushSchema).safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({
          message: "Invalid sync journal payload",
          errors: bodyParsed.error.errors,
        });
        return;
      }

      const journalList = bodyParsed.data;
      const errors: any[] = [];
      let syncedCount = 0;

      for (const entry of journalList) {
        try {
          await query(
            `INSERT INTO meal_journal (id, user_id, meal_type, scanned_at, compliance_score)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               meal_type = EXCLUDED.meal_type,
               scanned_at = EXCLUDED.scanned_at,
               compliance_score = EXCLUDED.compliance_score`,
            [
              entry.id,
              user.id,
              entry.meal_type,
              entry.created_at,
              entry.compliance_score,
            ]
          );

          syncedCount++;
        } catch (err: any) {
          console.error(`Failed syncing journal entry ${entry.id}:`, err);
          errors.push({ id: entry.id, error: err.message });
        }
      }

      res.json({
        synced: syncedCount,
        errors,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
