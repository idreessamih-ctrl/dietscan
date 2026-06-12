import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error("API Error encountered:", err);

  let statusCode = 500;
  let message = "Internal Server Error";

  if (err instanceof Error) {
    message = err.message;
    if ("status" in err && typeof (err as { status: unknown }).status === "number") {
      statusCode = (err as { status: number }).status;
    } else if ("statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number") {
      statusCode = (err as { statusCode: number }).statusCode;
    }
  } else if (err && typeof err === "object") {
    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      message = (err as { message: string }).message;
    }
    if ("status" in err && typeof (err as { status: unknown }).status === "number") {
      statusCode = (err as { status: number }).status;
    }
  }

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
    },
  });
}
