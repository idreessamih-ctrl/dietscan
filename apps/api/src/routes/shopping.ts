import { Router, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { query } from "../lib/db";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";
import { evaluateIngredients } from "../rules/engine";

const router = Router();

const createListSchema = z.object({
  name: z.string().min(1).max(255),
});

const addItemSchema = z.object({
  productId: z.string().uuid(),
});

const updateItemSchema = z.object({
  checked: z.boolean(),
});

/**
 * Helper to determine compliance badge for a product based on user protocol slug.
 * Returns: 'green' (🟢), 'red' (🔴), or 'gray' (⚪)
 */
async function getComplianceBadge(protocolSlug: string | null | undefined, ingredientsJson: unknown): Promise<string> {
  if (!protocolSlug) {
    return "gray";
  }

  let ingredients: string[] = [];
  try {
    if (typeof ingredientsJson === "string") {
      ingredients = JSON.parse(ingredientsJson) as string[];
    } else if (Array.isArray(ingredientsJson)) {
      ingredients = ingredientsJson as string[];
    }
  } catch {
    ingredients = [];
  }

  const result = await evaluateIngredients(protocolSlug, ingredients);
  return result.passed ? "green" : "red";
}

// POST /shopping/lists - create list
router.post(
  "/lists",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const parsed = createListSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { name } = parsed.data;

      const result = await query<{ id: string; user_id: string; name: string }>(
        "INSERT INTO shopping_lists (user_id, name) VALUES ($1, $2) RETURNING id, user_id, name",
        [userId, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// GET /shopping/lists - user's lists
router.get(
  "/lists",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const result = await query<{ id: string; user_id: string; name: string }>(
        "SELECT id, user_id, name FROM shopping_lists WHERE user_id = $1 ORDER BY name ASC",
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// GET /shopping/lists/:id - single list with items
router.get(
  "/lists/:id",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const listId = req.params.id;

      // Ensure list belongs to user
      const listResult = await query<{ id: string; name: string }>(
        "SELECT id, name FROM shopping_lists WHERE id = $1 AND user_id = $2",
        [listId, userId]
      );

      if (listResult.rows.length === 0) {
        res.status(404).json({ message: "Shopping list not found" });
        return;
      }

      const list = listResult.rows[0];

      // Retrieve items with product info
      interface RawItemRow {
        id: string;
        checked: boolean;
        productId: string;
        productName: string;
        productBrand: string | null;
        ingredientsJson: unknown;
      }

      const itemsResult = await query<RawItemRow>(
        `SELECT sli.id, sli.checked, sli.product_id as "productId",
                p.name as "productName", p.brand as "productBrand", p.ingredients_json as "ingredientsJson"
         FROM shopping_list_items sli
         JOIN products p ON sli.product_id = p.id
         WHERE sli.list_id = $1`,
        [listId]
      );

      // Determine compliance badge for each item based on user protocol slug
      const protocolSlug = req.dbUser?.dietary_protocol;

      const items = await Promise.all(
        itemsResult.rows.map(async (row) => {
          const complianceBadge = await getComplianceBadge(protocolSlug, row.ingredientsJson);
          return {
            id: row.id,
            productId: row.productId,
            name: row.productName,
            brand: row.productBrand,
            checked: row.checked,
            complianceBadge,
          };
        })
      );

      res.json({
        id: list.id,
        name: list.name,
        items,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /shopping/lists/:id/items - add item to list
router.post(
  "/lists/:id/items",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const listId = req.params.id;

      // Ensure list belongs to user
      const listResult = await query(
        "SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2",
        [listId, userId]
      );

      if (listResult.rows.length === 0) {
        res.status(404).json({ message: "Shopping list not found" });
        return;
      }

      const parsed = addItemSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { productId } = parsed.data;

      // Ensure product exists
      const productResult = await query("SELECT id FROM products WHERE id = $1", [productId]);
      if (productResult.rows.length === 0) {
        res.status(400).json({ message: "Product not found" });
        return;
      }

      const result = await query<{ id: string; list_id: string; product_id: string; checked: boolean }>(
        "INSERT INTO shopping_list_items (list_id, product_id) VALUES ($1, $2) RETURNING id, list_id, product_id, checked",
        [listId, productId]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /shopping/lists/:id/items/:itemId - toggle checked
router.patch(
  "/lists/:id/items/:itemId",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { id: listId, itemId } = req.params;

      // Ensure list belongs to user
      const listResult = await query(
        "SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2",
        [listId, userId]
      );

      if (listResult.rows.length === 0) {
        res.status(404).json({ message: "Shopping list not found" });
        return;
      }

      const parsed = updateItemSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { checked } = parsed.data;

      const result = await query<{ id: string; checked: boolean }>(
        "UPDATE shopping_list_items SET checked = $1 WHERE id = $2 AND list_id = $3 RETURNING id, checked",
        [checked, itemId, listId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Shopping list item not found" });
        return;
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /shopping/lists/:id/items/:itemId - remove item
router.delete(
  "/lists/:id/items/:itemId",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { id: listId, itemId } = req.params;

      // Ensure list belongs to user
      const listResult = await query(
        "SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2",
        [listId, userId]
      );

      if (listResult.rows.length === 0) {
        res.status(404).json({ message: "Shopping list not found" });
        return;
      }

      const result = await query(
        "DELETE FROM shopping_list_items WHERE id = $1 AND list_id = $2 RETURNING id",
        [itemId, listId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Shopping list item not found" });
        return;
      }

      res.json({ message: "Item removed successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /shopping/lists/:id - delete list
router.delete(
  "/lists/:id",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const listId = req.params.id;

      const result = await query(
        "DELETE FROM shopping_lists WHERE id = $1 AND user_id = $2 RETURNING id",
        [listId, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Shopping list not found" });
        return;
      }

      res.json({ message: "Shopping list deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
