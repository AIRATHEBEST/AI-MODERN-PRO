import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import puter from 'puter';

/**
 * Standalone SDK using Puter.js for authentication and session management.
 * This replaces the Manus-specific OAuth and sync logic.
 */

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret || "puter-standalone-secret-key-12345";
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId || "puter-app",
        name: options.name || "Puter User",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, string>;

      if (!openId || !appId || !name) return null;

      return { openId, appId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * Authenticate request using session cookie or Puter.js token
   */
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    
    // 1. Try session cookie first
    const session = await this.verifySession(sessionCookie);
    if (session) {
      const user = await db.getUserByOpenId(session.openId);
      if (user) {
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });
        return user;
      }
    }

    // 2. Fallback to Puter.js authentication if available
    try {
      if (puter.auth.isSignedIn()) {
        const puterUser = await puter.auth.getUser();
        if (puterUser) {
          const openId = `puter:${puterUser.id}`;
          await db.upsertUser({
            openId,
            name: puterUser.username || null,
            email: puterUser.email || null,
            loginMethod: "puter",
            lastSignedIn: new Date(),
          });
          const user = await db.getUserByOpenId(openId);
          if (user) return user;
        }
      }
    } catch (error) {
      console.warn("[Auth] Puter auth check failed:", error);
    }

    throw ForbiddenError("Authentication required");
  }
}

export const sdk = new SDKServer();
