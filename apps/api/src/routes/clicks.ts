import { Router, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../lib/db";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";

const router = Router();

const clickSchema = z.object({
  productId: z.string().uuid(),
  retailerId: z.string().uuid(),
  redirectUrl: z.string().url(),
});

const postbackSchema = z.object({
  click_id: z.string(),
  order_id: z.string(),
  amount: z.coerce.number().min(0),
  commission: z.coerce.number().min(0),
});

/**
 * POST /clicks
 * Creates an affiliate click record and returns the redirect URL with clickId appended.
 * Protected by SuperTokens session.
 */
router.post(
  "/clicks",
  verifySession,
  resolveUser as any,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = clickSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid input",
          errors: parsed.error.errors,
        });
        return;
      }

      const { productId, retailerId, redirectUrl } = parsed.data;
      const userId = req.dbUser?.id;

      if (!userId) {
        res.status(401).json({ message: "User not authenticated in database" });
        return;
      }

      // Pre-validate that product and retailer exist
      const productRes = await query("SELECT id FROM products WHERE id = $1", [productId]);
      if (productRes.rows.length === 0) {
        res.status(400).json({ message: "Product not found" });
        return;
      }

      const retailerRes = await query("SELECT id FROM affiliate_retailers WHERE id = $1", [retailerId]);
      if (retailerRes.rows.length === 0) {
        res.status(400).json({ message: "Retailer not found" });
        return;
      }

      // Generate UUID v4 click_id
      const clickId = crypto.randomUUID();

      // Store in affiliate_clicks table
      await query(
        `INSERT INTO affiliate_clicks (user_id, product_id, retailer_id, click_id)
         VALUES ($1, $2, $3, $4)`,
        [userId, productId, retailerId, clickId]
      );

      // Append clickId to redirectUrl
      const url = new URL(redirectUrl);
      url.searchParams.set("clickId", clickId);
      const finalRedirectUrl = url.toString();

      res.status(201).json({
        clickId,
        redirectUrl: finalRedirectUrl,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /postback
 * Records conversion from affiliate networks.
 * Idempotent: returns 409 Conflict if click_id is already converted.
 */
router.get(
  "/postback",
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = postbackSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid query parameters",
          errors: parsed.error.errors,
        });
        return;
      }

      const { click_id, order_id, amount, commission } = parsed.data;

      // Validate click_id exists
      const clickRes = await query("SELECT click_id FROM affiliate_clicks WHERE click_id = $1", [click_id]);
      if (clickRes.rows.length === 0) {
        res.status(404).json({ message: "Click ID not found" });
        return;
      }

      // Check if already converted
      const conversionRes = await query("SELECT id FROM affiliate_conversions WHERE click_id = $1", [click_id]);
      if (conversionRes.rows.length > 0) {
        res.status(409).json({ message: "Conversion already recorded for this click ID" });
        return;
      }

      // Store conversion in affiliate_conversions
      await query(
        `INSERT INTO affiliate_conversions (click_id, order_id, amount, commission, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [click_id, order_id, amount, commission, "completed"]
      );

      res.status(200).json({ message: "Conversion recorded successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
