import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import puter from 'puter';

/**
 * Standalone OAuth routes using Puter.js for authentication.
 * This replaces the Manus-specific OAuth and sync logic.
 */

export function registerOAuthRoutes(app: Express) {
  /**
   * Puter.js standalone login route
   * This route is called when the user clicks "Sign in to continue"
   */
  app.get("/api/auth/login", async (req: Request, res: Response) => {
    try {
      // Puter.js handles the login flow.
      // In a standalone app, we can use Puter's auth.signIn() or redirect to Puter's login page.
      // Here we'll redirect to Puter's login page if not signed in.
      if (!puter.auth.isSignedIn()) {
        // Puter.js auth.signIn() usually works in the browser.
        // For server-side redirect, we can use Puter's OAuth or a simple redirect.
        res.redirect(302, "https://puter.com/login");
        return;
      }

      const puterUser = await puter.auth.getUser();
      if (!puterUser) {
        res.status(401).json({ error: "Failed to get Puter user info" });
        return;
      }

      const openId = `puter:${puterUser.id}`;
      await db.upsertUser({
        openId,
        name: puterUser.username || null,
        email: puterUser.email || null,
        loginMethod: "puter",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: puterUser.username || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[Auth] Puter login failed", error);
      res.status(500).json({ error: "Puter login failed" });
    }
  });

  /**
   * Puter.js callback route
   * This route is called after the user signs in via Puter.js
   */
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    // In a standalone app, we can use Puter's auth.signIn() or redirect to Puter's login page.
    // This is a placeholder for Puter's OAuth callback if needed.
    res.redirect(302, "/api/auth/login");
  });
}
