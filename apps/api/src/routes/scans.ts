import { Router } from "express";
import { optionalSession } from "../middleware/auth";
import { evaluateIngredients } from "../rules/engine";

const router = Router();

/**
 * POST /scans/ingredients
 * Public endpoint to evaluate a raw ingredients list against a protocol.
 * Uses optionalSession middleware to extract session if present.
 */
router.post("/ingredients", optionalSession, async (req, res, next) => {
  try {
    const { ingredients, protocolSlug } = req.body as {
      ingredients?: unknown;
      protocolSlug?: unknown;
    };

    if (!ingredients || !Array.isArray(ingredients)) {
      res.status(400).json({ message: "ingredients must be an array of strings" });
      return;
    }

    if (!protocolSlug || typeof protocolSlug !== "string") {
      res.status(400).json({ message: "protocolSlug must be a string" });
      return;
    }

    // Verify all items in ingredients array are strings
    const ingredientsArray: string[] = [];
    for (const item of ingredients) {
      if (typeof item !== "string") {
        res.status(400).json({ message: "All items in ingredients must be strings" });
        return;
      }
      ingredientsArray.push(item);
    }

    const report = await evaluateIngredients(protocolSlug, ingredientsArray);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

export default router;
