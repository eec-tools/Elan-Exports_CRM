import { Request, Response } from "express";
import { getAuthUrl, exchangeCodeForToken, getConfiguredAccounts } from "../services/gmailService.js";
import { AuthRequest } from "../types/index.js";

/**
 * GET /api/gmail/accounts
 * List all configured Gmail accounts with connection status
 */
export async function listAccounts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const accounts = await getConfiguredAccounts();
    res.json(accounts);
  } catch (err) {
    console.error("[gmail] listAccounts error:", err);
    res.status(500).json({ error: "Failed to list Gmail accounts" });
  }
}

/**
 * GET /api/gmail/auth?email=sales@elanexports.com
 * Returns the Google OAuth consent URL — frontend opens it in the browser
 */
export async function initiateAuth(req: Request, res: Response): Promise<void> {
  const email = req.query.email as string;
  if (!email) {
    res.status(400).json({ error: "email query param is required" });
    return;
  }
  const url = getAuthUrl(email);
  res.json({ url });
}

/**
 * GET /api/gmail/callback?code=...&state=email
 * OAuth callback — exchanges code for refresh token, saves it, redirects to frontend settings page
 */
export async function handleCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string;
  const email = (req.query.state as string) || (req.query.email as string);
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0] ?? "http://localhost:5173";

  if (!code || !email) {
    const details = [];
    if (!code) details.push("code");
    if (!email) details.push("state/email");
    const msg = `Missing OAuth callback params: ${details.join(", ")}`;
    res.redirect(`${frontendUrl}/settings/gmail?error=${encodeURIComponent(msg)}`);
    return;
  }
  try {
    await exchangeCodeForToken(code, email);
    res.redirect(`${frontendUrl}/settings/gmail?connected=${encodeURIComponent(email)}`);
  } catch (err: any) {
    console.error("[gmail] OAuth callback error:", err);
    res.redirect(`${frontendUrl}/settings/gmail?error=${encodeURIComponent(err.message)}`);
  }
}
