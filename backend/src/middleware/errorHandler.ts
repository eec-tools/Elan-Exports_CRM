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

  // Handle CORS errors specifically
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "CORS policy violation",
      message: "Origin not allowed",
    });
  }

  // Handle specific error types
  const statusCode = (err as any).statusCode || 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV !== "production" && {
      message: err.message,
      stack: err.stack
    }),
  });
}
