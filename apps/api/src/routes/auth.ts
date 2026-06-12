import { Router, Request, Response } from "express";

const router = Router();

// Placeholder for auth routes
router.get("/session-test", (req: Request, res: Response) => {
  res.json({
    message: "Auth route placeholder active",
  });
});

export default router;
