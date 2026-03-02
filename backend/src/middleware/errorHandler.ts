import { Request, Response, NextFunction } from "express";

/**
 * Global error handler — catches unhandled errors from route handlers
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { message: err.message }),
  });
}
