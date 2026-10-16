"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { passwordProblem } from "@/lib/password";
import { getSession } from "@/lib/session";

/**
 * Anyone signed in: change your own password. Used by the Account page and
 * by /change-password (the starting password, which must be changed first).
 */
export async function changePassword(formData: FormData) {
  const { supabase, user, profile } = await getSession();
  // Which page to go back to with an error: one of two, never a free address.
  const back = formData.get("first") === "1" ? "/change-password" : "/account";

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (passwordProblem(password, profile.phone)) redirect(`${back}?error=password_short`);
  if (password !== confirm) redirect(`${back}?error=password_mismatch`);

  // Prove it's really them (Ticket 42): someone who picks up a phone that
  // was left signed in can't lock the owner out. Checked with a separate
  // client that keeps no session, so nothing about this sign-in changes.
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: wrong } = await check.auth.signInWithPassword({ email: user.email ?? "", password: current });
  if (wrong) redirect(`${back}?error=password_current`);

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = error.code === "weak_password" ? "password_short" : error.code === "same_password" ? "password_same" : "save_failed";
    redirect(`${back}?error=${code}`);
  }

  redirect(back === "/account" ? "/account?saved=1" : "/");
}
