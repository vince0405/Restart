import { createClient } from "@supabase/supabase-js";

/**
 * Creates an account for SOMEONE ELSE (used by the Chairperson's "Add a
 * person" form). Server only.
 *
 * Still the publishable (anon) key — exactly what the public sign-up page
 * uses. No service_role key: that would bypass Row Level Security.
 *
 * This client deliberately keeps no session and writes no cookies, so the
 * Chairperson stays signed in as themselves. The new account starts as a
 * Customer (the database decides that); the caller then gives it a role
 * with set_person(), which only the Chairperson may call.
 */
export async function createAccount(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase env vars missing.");

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName, phone: input.phone } },
  });
}
