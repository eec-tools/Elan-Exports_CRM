import { ZodError } from "zod";
/**
 * Create middleware that validates req.body against a Zod schema
 */
export function validate(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                res.status(400).json({
                    error: "Validation failed",
                    details: err.errors.map((e) => ({
                        path: e.path.join("."),
                        message: e.message,
                    })),
                });
                return;
            }
            next(err);
        }
    };
}
//# sourceMappingURL=validate.js.map