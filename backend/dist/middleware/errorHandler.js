/**
 * Global error handler — catches unhandled errors from route handlers
 */
export function errorHandler(err, _req, res, _next) {
    console.error("Unhandled error:", err);
    // Handle CORS errors specifically
    if (err.message === "Not allowed by CORS") {
        res.status(403).json({
            error: "CORS policy violation",
            message: "Origin not allowed",
        });
        return;
    }
    // Handle specific error types
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: statusCode === 500 ? "Internal server error" : err.message,
        ...(process.env.NODE_ENV !== "production" && {
            message: err.message,
            stack: err.stack
        }),
    });
}
//# sourceMappingURL=errorHandler.js.map