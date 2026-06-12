import { Router, Request, Response } from "express";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

export default router;
