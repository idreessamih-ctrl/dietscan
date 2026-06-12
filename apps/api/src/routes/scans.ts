import { Router, Request, Response, NextFunction } from "express";
import { optionalSession } from "../middleware/auth";
import { evaluateIngredients } from "../rules/engine";
import { z } from "zod";

const router = Router();

const scanSchema = z.object({
  ingredients: z.array(z.string()),
  protocolSlug: z.string(),
});

/**
 * POST /scans/ingredients or POST /scans
 * Public endpoint to evaluate a raw ingredients list against a protocol.
 * Validates inputs using zod.
 */
async function handleScan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = scanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid input. 'ingredients' must be an array of strings and 'protocolSlug' must be a string.",
        errors: parsed.error.errors,
      });
      return;
    }

    const { ingredients, protocolSlug } = parsed.data;
    const report = await evaluateIngredients(protocolSlug, ingredients);
    res.json(report);
  } catch (error) {
    next(error);
  }
}

router.post("/ingredients", optionalSession, handleScan);
router.post("/", optionalSession, handleScan);

export default router;
