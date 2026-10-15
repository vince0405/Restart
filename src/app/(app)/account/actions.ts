"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** Anyone signed in: change your own password (e.g. the starting one). */
export async function changePassword(formData: FormData) {
  const { supabase } = await getSession();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) redirect("/account?error=password_short");
  if (password !== confirm) redirect("/account?error=password_mismatch");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/account?error=${error.code === "weak_password" ? "password_short" : "save_failed"}`);
  }

  redirect("/account?saved=1");
}
