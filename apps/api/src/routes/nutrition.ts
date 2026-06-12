import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { query } from "../lib/db";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";

const router = Router();

const dailyQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function extractNutrient(nutritionJson: any, keys: string[]): number {
  if (!nutritionJson) return 0;
  for (const key of keys) {
    if (key in nutritionJson) {
      const val = parseFloat(nutritionJson[key]);
      if (!isNaN(val)) return val;
    }
  }
  return 0;
}

// GET /nutrition/daily?date=X
router.get(
  "/daily",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const parsed = dailyQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD", errors: parsed.error.errors });
        return;
      }

      const dateStr = parsed.data.date || new Date().toISOString().slice(0, 10);

      // Fetch scans for the user on this date
      const scansResult = await query<{
        id: string;
        scanned_at: Date;
        product_id: string;
        name: string;
        brand: string | null;
        nutrition_json: any;
      }>(
        `SELECT s.id, s.scanned_at, s.product_id, p.name, p.brand, p.nutrition_json
         FROM scans s
         JOIN products p ON s.product_id = p.id
         WHERE s.user_id = $1 AND s.scanned_at::date = $2
         ORDER BY s.scanned_at ASC`,
        [userId, dateStr]
      );

      let totalCalories = 0;
      let totalCarbs = 0;
      let totalProtein = 0;
      let totalFat = 0;
      let totalFiber = 0;
      let totalSalt = 0;

      const items = scansResult.rows.map(row => {
        const nut = row.nutrition_json || {};
        const cal = extractNutrient(nut, ["energy-kcal_100g", "energy-kcal"]);
        const carb = extractNutrient(nut, ["carbohydrates_100g", "carbohydrates"]);
        const prot = extractNutrient(nut, ["proteins_100g", "proteins"]);
        const fatVal = extractNutrient(nut, ["fat_100g", "fat"]);
        const fib = extractNutrient(nut, ["fiber_100g", "fiber"]);
        const saltVal = extractNutrient(nut, ["salt_100g", "salt"]);

        totalCalories += cal;
        totalCarbs += carb;
        totalProtein += prot;
        totalFat += fatVal;
        totalFiber += fib;
        totalSalt += saltVal;

        return {
          id: row.id,
          productId: row.product_id,
          name: row.name,
          brand: row.brand,
          scannedAt: row.scanned_at,
          nutrition: {
            calories: cal,
            carbs: carb,
            protein: prot,
            fat: fatVal,
            fiber: fib,
            salt: saltVal,
          }
        };
      });

      res.json({
        date: dateStr,
        summary: {
          calories: Math.round(totalCalories * 100) / 100,
          carbs: Math.round(totalCarbs * 100) / 100,
          protein: Math.round(totalProtein * 100) / 100,
          fat: Math.round(totalFat * 100) / 100,
          fiber: Math.round(totalFiber * 100) / 100,
          salt: Math.round(totalSalt * 100) / 100,
        },
        targets: {
          calories: 2000,
          carbs: 250,
          protein: 80,
          fat: 70,
          fiber: 30,
          salt: 6,
        },
        items,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /nutrition/weekly
router.get(
  "/weekly",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      // Generate last 7 days dates
      const dailyData: any[] = [];
      const now = new Date();
      
      // Calculate daily data for last 7 days (including today)
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);

        // Fetch scan nutrition totals for this date
        const scansRes = await query<{ nutrition_json: any }>(
          `SELECT p.nutrition_json
           FROM scans s
           JOIN products p ON s.product_id = p.id
           WHERE s.user_id = $1 AND s.scanned_at::date = $2`,
          [userId, dateStr]
        );

        let calories = 0;
        let carbs = 0;
        let protein = 0;
        let fat = 0;
        let fiber = 0;
        let salt = 0;

        for (const row of scansRes.rows) {
          const nut = row.nutrition_json || {};
          calories += extractNutrient(nut, ["energy-kcal_100g", "energy-kcal"]);
          carbs += extractNutrient(nut, ["carbohydrates_100g", "carbohydrates"]);
          protein += extractNutrient(nut, ["proteins_100g", "proteins"]);
          fat += extractNutrient(nut, ["fat_100g", "fat"]);
          fiber += extractNutrient(nut, ["fiber_100g", "fiber"]);
          salt += extractNutrient(nut, ["salt_100g", "salt"]);
        }

        // Fetch compliance score average for this date
        const journalRes = await query<{ avg_score: string }>(
          `SELECT AVG(compliance_score) as avg_score
           FROM meal_journal
           WHERE user_id = $1 AND scanned_at::date = $2`,
          [userId, dateStr]
        );

        const avgScore = journalRes.rows[0]?.avg_score ? parseFloat(journalRes.rows[0].avg_score) : 0;

        dailyData.push({
          date: dateStr,
          calories: Math.round(calories * 100) / 100,
          carbs: Math.round(carbs * 100) / 100,
          protein: Math.round(protein * 100) / 100,
          fat: Math.round(fat * 100) / 100,
          fiber: Math.round(fiber * 100) / 100,
          salt: Math.round(salt * 100) / 100,
          complianceScore: Math.round(avgScore * 100) / 100,
        });
      }

      // Calculate streak
      const streakResult = await query<{ log_date: string }>(
        `SELECT DISTINCT (scanned_at AT TIME ZONE 'UTC')::date::text as log_date
         FROM (
           SELECT scanned_at FROM meal_journal WHERE user_id = $1
           UNION
           SELECT scanned_at FROM scans WHERE user_id = $1
         ) combined
         ORDER BY log_date DESC`,
        [userId]
      );

      const loggedDates = new Set(streakResult.rows.map(r => r.log_date));
      let streak = 0;
      const checkDate = new Date();
      const todayStr = checkDate.toISOString().slice(0, 10);
      
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = checkDate.toISOString().slice(0, 10);

      let currentCheckingStr = todayStr;
      if (loggedDates.has(todayStr)) {
        streak = 1;
      } else if (loggedDates.has(yesterdayStr)) {
        streak = 1;
        currentCheckingStr = yesterdayStr;
      }

      if (streak > 0) {
        // Backtrack from currentCheckingStr
        const iterDate = new Date(currentCheckingStr);
        while (true) {
          iterDate.setDate(iterDate.getDate() - 1);
          const iterStr = iterDate.toISOString().slice(0, 10);
          if (loggedDates.has(iterStr)) {
            streak++;
          } else {
            break;
          }
        }
      }

      // Calculate average compliance
      const overallJournalRes = await query<{ avg_score: string }>(
        `SELECT AVG(compliance_score) as avg_score
         FROM meal_journal
         WHERE user_id = $1`,
        [userId]
      );
      const avgCompliance = overallJournalRes.rows[0]?.avg_score ? parseFloat(overallJournalRes.rows[0].avg_score) : 0;

      res.json({
        dailyData,
        streak,
        averageCompliance: Math.round(avgCompliance * 100) / 100,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
