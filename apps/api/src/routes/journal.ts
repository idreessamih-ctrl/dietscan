import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { query } from "../lib/db";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";

const router = Router();

const createJournalSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  complianceScore: z.number().min(0).max(100),
  scannedAt: z.string().optional(),
});

// GET /journal - List all entries for authenticated user
router.get(
  "/",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const result = await query(
        `SELECT id, user_id as "userId", meal_type as "mealType", scanned_at as "scannedAt", compliance_score as "complianceScore"
         FROM meal_journal
         WHERE user_id = $1
         ORDER BY scanned_at DESC`,
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

// GET /journal/summary - Get summary metrics for user
router.get(
  "/summary",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const result = await query<{
        totalMeals: number;
        averageCompliance: number;
        breakfastCount: number;
        lunchCount: number;
        dinnerCount: number;
        snackCount: number;
      }>(
        `SELECT
           COUNT(*)::int as "totalMeals",
           ROUND(COALESCE(AVG(compliance_score), 0), 2)::float as "averageCompliance",
           COUNT(*) FILTER (WHERE meal_type = 'breakfast')::int as "breakfastCount",
           COUNT(*) FILTER (WHERE meal_type = 'lunch')::int as "lunchCount",
           COUNT(*) FILTER (WHERE meal_type = 'dinner')::int as "dinnerCount",
           COUNT(*) FILTER (WHERE meal_type = 'snack')::int as "snackCount"
         FROM meal_journal
         WHERE user_id = $1`,
        [userId]
      );

      const row = result.rows[0];
      res.json({
        totalMeals: row.totalMeals || 0,
        averageCompliance: row.averageCompliance || 0,
        mealTypeBreakdown: {
          breakfast: row.breakfastCount || 0,
          lunch: row.lunchCount || 0,
          dinner: row.dinnerCount || 0,
          snack: row.snackCount || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /journal - Create a new journal entry
router.post(
  "/",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const parsed = createJournalSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { mealType, complianceScore, scannedAt } = parsed.data;
      const dateVal = scannedAt ? new Date(scannedAt) : new Date();

      const result = await query(
        `INSERT INTO meal_journal (user_id, meal_type, compliance_score, scanned_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id as "userId", meal_type as "mealType", scanned_at as "scannedAt", compliance_score as "complianceScore"`,
        [userId, mealType, complianceScore, dateVal.toISOString()]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /journal/:id - Delete a journal entry
router.delete(
  "/:id",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const { id } = req.params;
      const deleteResult = await query("DELETE FROM meal_journal WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
      if (deleteResult.rowCount === 0) {
        res.status(404).json({ message: "Journal entry not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
