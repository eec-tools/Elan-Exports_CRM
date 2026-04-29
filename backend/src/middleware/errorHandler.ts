import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error("Unhandled error:", err);

  // Ensure CORS headers are present on error responses so the browser
  // can read the error body rather than showing a misleading CORS error.
  const origin = req.headers.origin;
  if (origin && !res.headersSent) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (err.message === "Not allowed by CORS") {
    res.status(403).json({
      error: "CORS policy violation",
      message: "Origin not allowed",
    });
    return;
  }

  const statusCode = (err as any).statusCode || 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV !== "production" && {
      message: err.message,
      stack: err.stack
    }),
  });
}
