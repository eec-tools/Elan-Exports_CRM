/**
 * Global error handler — catches unhandled errors from route handlers
 */
export function errorHandler(err, _req, res, _next) {
    console.error("Unhandled error:", err);
    res.status(500).json({
        error: "Internal server error",
        ...(process.env.NODE_ENV !== "production" && { message: err.message }),
    });
}
//# sourceMappingURL=errorHandler.js.map