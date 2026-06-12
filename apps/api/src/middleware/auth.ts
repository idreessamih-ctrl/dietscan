import { verifySession as superTokensVerifySession } from "supertokens-node/recipe/session/framework/express";
import { Request, Response, NextFunction } from "express";
import SuperTokens from "supertokens-node";
import { query } from "../lib/db";

// Required session middleware for protected routes
export const verifySession = superTokensVerifySession();

// Optional session middleware for public routes that can consume session info if present
export const optionalSession = superTokensVerifySession({
  sessionRequired: false,
});

export interface CustomRequest extends Request {
  session?: any;
  dbUser?: {
    id: string;
    email: string;
    dietary_protocol: string | null;
    created_at: Date;
  };
}

export async function resolveUser(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.session) {
      const supertokensUserId = req.session.getUserId();
      let userRes = await query("SELECT * FROM users WHERE id = $1", [supertokensUserId]);
      if (userRes.rows.length === 0) {
        const stUser = await SuperTokens.getUser(supertokensUserId);
        if (stUser) {
          const email = stUser.emails?.[0] || stUser.loginMethods?.[0]?.email || "";
          await query(
            "INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email",
            [supertokensUserId, email]
          );
          userRes = await query("SELECT * FROM users WHERE id = $1", [supertokensUserId]);
        }
      }
      if (userRes.rows.length > 0) {
        req.dbUser = userRes.rows[0] as any;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

