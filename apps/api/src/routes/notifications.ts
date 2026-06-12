import { Router, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { query } from "../lib/db";
import { verifySession, resolveUser, CustomRequest } from "../middleware/auth";
import { sendPushNotification } from "../services/notifications";

// Ensure the push_token column exists in users table
query("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token VARCHAR(255)")
  .then(() => console.log("[Database] push_token column verified/added successfully"))
  .catch((err) => console.error("[Database] Error ensuring push_token column:", err));

const router = Router();

const registerTokenSchema = z.object({
  token: z.string().min(1),
});

const sendNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

// POST /notifications/register - save push token for user
router.post(
  "/register",
  verifySession,
  resolveUser as RequestHandler,
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.dbUser?.id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      const parsed = registerTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { token } = parsed.data;

      await query("UPDATE users SET push_token = $1 WHERE id = $2", [token, userId]);

      res.status(200).json({ message: "Push token registered successfully" });
    } catch (error) {
      next(error);
    }
  }
);

// POST /notifications/send - admin trigger (protected by API key)
router.post(
  "/send",
  async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminApiKey = process.env.ADMIN_API_KEY || "admin-secret";
      const headerKey = req.headers["x-admin-api-key"] || req.headers["x-admin-key"];

      if (headerKey !== adminApiKey) {
        res.status(403).json({ message: "Forbidden: Invalid admin API key" });
        return;
      }

      const parsed = sendNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
        return;
      }

      const { userId, title, body, data } = parsed.data;

      // Get user push token
      const userRes = await query<{ push_token: string | null }>(
        "SELECT push_token FROM users WHERE id = $1",
        [userId]
      );

      if (userRes.rows.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const pushToken = userRes.rows[0].push_token;
      if (!pushToken) {
        res.status(422).json({ message: "User does not have a registered push token" });
        return;
      }

      await sendPushNotification(pushToken, title, body, data);

      res.status(200).json({ message: "Push notification triggered successfully" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
