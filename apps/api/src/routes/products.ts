import { Router } from "express";
import { productsLimiter } from "../middleware/rateLimiter";
import { lookupBarcode } from "../lib/off";

const router = Router();

/**
 * POST /products/lookup
 * Public endpoint to search for a product by barcode.
 * Rate limited to 30 req/min.
 */
router.post("/lookup", productsLimiter, async (req, res, next) => {
  try {
    const { barcode } = req.body as { barcode?: unknown };

    if (!barcode || typeof barcode !== "string") {
      res.status(400).json({ message: "barcode must be a string" });
      return;
    }

    const product = await lookupBarcode(barcode);
    if (!product) {
      res.status(404).json({ message: "Product not found on Open Food Facts" });
      return;
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

export default router;
