import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://oredszasbvkvejvbooki.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZWRzemFzYnZrdmVqdmJvb2tpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjYwODQwNiwiZXhwIjoyMDg4MTg0NDA2fQ.ylnXwD-kF1sxJGk_s2pG4vROVZijGZRjZXDp4GOapw8";

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log("Testing Supabase connection...");

// Test signInWithPassword
const { data, error } = await supabase.auth.signInWithPassword({
  email: "ntshongwanae@gmail.com",
  password: "@960145404"
});

if (error) {
  console.error("Login error:", error.message, error.status);
} else {
  console.log("Login success! User:", data.user?.email, "ID:", data.user?.id);
}
