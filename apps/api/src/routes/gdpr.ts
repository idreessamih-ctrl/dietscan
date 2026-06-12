import { Router, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import SuperTokens from "supertokens-node";
import { query } from "../lib/db";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";

const router = Router();

// GET /gdpr/export — download all user data as JSON
router.get(
  "/export",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const [
        userRes,
        mealJournalRes,
        mealPlansRes,
        mealPlanEntriesRes,
        shoppingListsRes,
        shoppingListItemsRes,
        scansRes,
        clicksRes
      ] = await Promise.all([
        query("SELECT id, email, dietary_protocol as \"dietaryProtocol\", push_token as \"pushToken\", created_at as \"createdAt\" FROM users WHERE id = $1", [userId]),
        query("SELECT id, meal_type as \"mealType\", scanned_at as \"scannedAt\", compliance_score as \"complianceScore\" FROM meal_journal WHERE user_id = $1", [userId]),
        query("SELECT id, week_start as \"weekStart\", protocol_slug as \"protocolSlug\" FROM meal_plans WHERE user_id = $1", [userId]),
        query("SELECT id, meal_plan_id as \"mealPlanId\", day_of_week as \"dayOfWeek\", meal_type as \"mealType\", product_id as \"productId\" FROM meal_plan_entries WHERE user_id = $1", [userId]),
        query("SELECT id, name FROM shopping_lists WHERE user_id = $1", [userId]),
        query("SELECT sli.id, sli.list_id as \"listId\", sli.product_id as \"productId\", sli.checked FROM shopping_list_items sli JOIN shopping_lists sl ON sli.list_id = sl.id WHERE sl.user_id = $1", [userId]),
        query("SELECT id, product_id as \"productId\", protocol_slug as \"protocolSlug\", passed, violations, scanned_at as \"scannedAt\" FROM scans WHERE user_id = $1", [userId]),
        query("SELECT id, product_id as \"productId\", retailer_id as \"retailerId\", click_id as \"clickId\", created_at as \"createdAt\" FROM affiliate_clicks WHERE user_id = $1", [userId])
      ]);

      const exportData = {
        user: userRes.rows[0] || null,
        mealJournal: mealJournalRes.rows,
        mealPlans: mealPlansRes.rows,
        mealPlanEntries: mealPlanEntriesRes.rows,
        shoppingLists: shoppingListsRes.rows,
        shoppingListItems: shoppingListItemsRes.rows,
        scans: scansRes.rows,
        affiliateClicks: clicksRes.rows
      };

      res.setHeader("Content-Disposition", 'attachment; filename="dietscan_user_data.json"');
      res.setHeader("Content-Type", "application/json");
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /gdpr/account — delete account + all data
router.delete(
  "/account",
  verifySession,
  resolveUser,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      // Revoke the session first
      if (req.session) {
        await req.session.revokeSession();
      }

      // Delete from DB (onDelete cascade will handle dependent records)
      await query("DELETE FROM users WHERE id = $1", [userId]);

      // Delete user from SuperTokens
      await SuperTokens.deleteUser(userId);

      res.json({ message: "Account and all associated data successfully deleted" });
    } catch (error) {
      next(error);
    }
  }
);

// GET /gdpr/privacy — return privacy policy text
router.get(
  "/privacy",
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const possiblePaths = [
        path.join(process.cwd(), "../../docs/PRIVACY.md"),
        path.join(process.cwd(), "docs/PRIVACY.md"),
        path.resolve(__dirname, "../../../../docs/PRIVACY.md"),
        path.resolve(__dirname, "../../../../../docs/PRIVACY.md")
      ];
      let content = "";
      for (const p of possiblePaths) {
        try {
          if (fs.existsSync(p)) {
            content = await fs.promises.readFile(p, "utf-8");
            break;
          }
        } catch {
          // ignore
        }
      }
      if (!content) {
        content = "# DietScan Privacy Policy\n\nFallback privacy policy content.";
      }
      res.json({ policy: content });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
