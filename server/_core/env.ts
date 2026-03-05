import "dotenv/config";

/**
 * Environment configuration for AI MODERN PRO.
 * Uses Supabase for authentication and PostgreSQL database.
 */
export const ENV = {
  appId: process.env.APP_ID || "ai-modern-pro",
  cookieSecret: process.env.JWT_SECRET || "standalone-secret-key-12345",
  databaseUrl: process.env.DATABASE_URL || "",
  isProduction: process.env.NODE_ENV === "production",

  // Supabase configuration
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // LLM Fallback
  forgeApiUrl: process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions",
  forgeApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "",

  // Owner ID for admin features
  ownerOpenId: process.env.OWNER_OPEN_ID || "",
};
