import { Request, Response, NextFunction } from "express";
import multer from "multer";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error("Unhandled error:", err);

  // Ensure CORS headers are present on error responses so the browser
  // can read the error body rather than showing a misleading CORS error
  // (connection drops or early errors can strip headers the CORS middleware set).
  const origin = req.headers.origin;
  if (origin && !res.headersSent) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (res.headersSent) return;

  if (err.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  // Multer-specific errors (file too large, unexpected field, etc.)
  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "File is too large. Maximum allowed size is 50 MB.",
      LIMIT_FILE_COUNT: "Too many files uploaded at once.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field in the upload request.",
    };
    res.status(400).json({ error: messages[err.code] ?? `Upload error: ${err.message}` });
    return;
  }

  const statusCode = (err as any).statusCode || 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV !== "production" && {
      message: err.message,
      stack: err.stack,
    }),
  });
}
