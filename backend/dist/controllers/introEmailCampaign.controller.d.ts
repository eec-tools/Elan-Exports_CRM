import { Response } from "express";
import { AuthRequest } from "../types/index.js";
/**
 * GET /api/intro-campaigns
 * List all campaigns with supplier info
 */
export declare function listCampaigns(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/intro-campaigns/due
 * Suppliers where nextFollowupDue <= today and status = active
 */
export declare function getDueCampaigns(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/intro-campaigns/stats
 */
export declare function getCampaignStats(req: AuthRequest, res: Response): Promise<void>;
/**
 * GET /api/intro-campaigns/:supplierId
 */
export declare function getCampaign(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/intro-campaigns/:supplierId/start
 * Create campaign and mark intro email as sent
 */
export declare function startCampaign(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/intro-campaigns/:supplierId/mark-sent
 * Mark the next follow-up in sequence as sent
 */
export declare function markEmailSent(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/intro-campaigns/:supplierId/mark-response
 * Record that supplier responded — stops the campaign
 */
export declare function markResponseReceived(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=introEmailCampaign.controller.d.ts.map