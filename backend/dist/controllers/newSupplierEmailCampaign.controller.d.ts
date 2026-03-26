import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/new-supplier-campaigns
 */
export declare function listCampaigns(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/new-supplier-campaigns/due
 */
export declare function getDueCampaigns(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/new-supplier-campaigns/stats
 */
export declare function getCampaignStats(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/new-supplier-campaigns/:id
 */
export declare function getCampaign(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/new-supplier-campaigns/:id/start
 */
export declare function startCampaign(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/new-supplier-campaigns/:id/mark-sent
 */
export declare function markEmailSent(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/new-supplier-campaigns/:id/mark-response
 */
export declare function markResponseReceived(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=newSupplierEmailCampaign.controller.d.ts.map