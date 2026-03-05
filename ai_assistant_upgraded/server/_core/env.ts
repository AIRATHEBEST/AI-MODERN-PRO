import "dotenv/config";

/**
 * Standalone environment configuration.
 * This removes Manus-specific variables and uses standard ones.
 */

export const ENV = {
  appId: process.env.APP_ID || "ai-assistant-app",
  cookieSecret: process.env.JWT_SECRET || "standalone-secret-key-12345",
  databaseUrl: process.env.DATABASE_URL || "",
  isProduction: process.env.NODE_ENV === "production",
  
  // LLM Fallback (if Puter AI is not used)
  forgeApiUrl: process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions",
  forgeApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "",
  
  // Owner ID for admin features
  ownerOpenId: process.env.OWNER_OPEN_ID || "",
};
