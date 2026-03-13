import { Request, Response } from "express";
export declare const getAllComplianceDocs: (_req: Request, res: Response) => Promise<void>;
export declare const createComplianceDoc: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateComplianceDoc: (req: Request, res: Response) => Promise<void>;
export declare const deleteComplianceDoc: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=compliance.controller.d.ts.map