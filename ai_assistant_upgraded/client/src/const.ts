export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Standalone client constants using Puter.js for authentication.
 * This replaces the Manus-specific OAuth and sync logic.
 */

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  // If Puter.js is not configured, return a placeholder URL
  // In a standalone app, we can use Puter's auth.signIn() or redirect to Puter's login page.
  // Here we'll redirect to Puter's login page if not signed in.
  return `${window.location.origin}/api/auth/login`;
};
