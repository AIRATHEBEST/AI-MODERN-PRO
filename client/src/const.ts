export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Client constants using Supabase for authentication.
 */
// The login page is served at the root with ?auth=login query param
export const getLoginUrl = () => {
  return `${window.location.origin}/?auth=login`;
};
