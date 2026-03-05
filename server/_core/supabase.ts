import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

/**
 * Supabase admin client (service role) for server-side operations.
 * Used for user management, auth verification, and admin tasks.
 */
let _adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!_adminClient) {
    if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
      throw new Error("Supabase URL and service role key are required");
    }
    _adminClient = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _adminClient;
}

/**
 * Verify a Supabase JWT access token and return the user UUID.
 */
export async function verifySupabaseToken(token: string): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
