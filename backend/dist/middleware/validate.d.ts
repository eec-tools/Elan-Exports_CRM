import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
/**
 * Create middleware that validates req.body against a Zod schema
 */
export declare function validate(schema: ZodSchema): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validate.d.ts.map