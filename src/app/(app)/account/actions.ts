"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** Anyone signed in: change your own password (e.g. the starting one). */
export async function changePassword(formData: FormData) {
  const { supabase, user } = await getSession();

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) redirect("/account?error=password_short");
  if (password !== confirm) redirect("/account?error=password_mismatch");

  // Prove it's really them (Ticket 42): someone who picks up a phone that
  // was left signed in can't lock the owner out. Checked with a separate
  // client that keeps no session, so nothing about this sign-in changes.
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: wrong } = await check.auth.signInWithPassword({ email: user.email ?? "", password: current });
  if (wrong) redirect("/account?error=password_current");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/account?error=${error.code === "weak_password" ? "password_short" : "save_failed"}`);
  }

  redirect("/account?saved=1");
}
