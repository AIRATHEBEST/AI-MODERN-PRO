import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { getSupabaseAdmin } from "./supabase";

/**
 * Auth routes using Supabase email/password authentication.
 */
export function registerOAuthRoutes(app: Express) {
  /**
   * POST /api/auth/login
   * Body: { email, password }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error || !data.user) {
        console.error("[Auth] Supabase login failed:", error?.message);
        res.status(401).json({ error: error?.message || "Invalid email or password" });
        return;
      }

      const supabaseUser = data.user;
      const openId = `supabase:${supabaseUser.id}`;
      const name = (supabaseUser.user_metadata?.name as string) ||
        supabaseUser.email?.split("@")[0] || "User";

      await db.upsertUser({
        openId,
        name,
        email: supabaseUser.email || null,
        loginMethod: "supabase",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: openId, name, email: supabaseUser.email } });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  /**
   * POST /api/auth/register
   * Body: { email, password, name? }
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body as {
        email?: string;
        password?: string;
        name?: string;
      };
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: { name: name || email.split("@")[0] },
      });

      if (error || !data.user) {
        console.error("[Auth] Supabase register failed:", error?.message);
        res.status(400).json({ error: error?.message || "Registration failed" });
        return;
      }

      const supabaseUser = data.user;
      const openId = `supabase:${supabaseUser.id}`;
      const displayName = name || supabaseUser.email?.split("@")[0] || "User";

      await db.upsertUser({
        openId,
        name: displayName,
        email: supabaseUser.email || null,
        loginMethod: "supabase",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        success: true,
        user: { id: openId, name: displayName, email: supabaseUser.email },
      });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  /**
   * GET /api/auth/login - redirect to login page
   */
  app.get("/api/auth/login", (_req: Request, res: Response) => {
    res.redirect(302, "/?auth=login");
  });

  /**
   * GET /api/oauth/callback - placeholder
   */
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/");
  });
}
