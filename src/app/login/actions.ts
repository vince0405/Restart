"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// A server action: this runs on the server when the sign-in form is
// submitted, so the password never touches our own JavaScript in the browser.
export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) redirect("/login?error=1");

  redirect("/");
}

// The sign-up problems people actually hit; the sign-up page has a friendly
// message for each. Anything else shows a general message, so we never
// echo raw error text onto the page.
const KNOWN_SIGN_UP_ERRORS = new Set([
  "user_already_exists",
  "weak_password",
  "signup_disabled",
  "email_address_invalid",
]);

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) redirect("/signup?error=name");

  // full_name and phone travel as "metadata"; the database copies them into
  // the new profile. The role is NOT sent: every new account is a customer.
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: {
      data: { full_name: fullName, phone: String(formData.get("phone") ?? "").trim() },
    },
  });

  if (error) {
    const key = error.code && KNOWN_SIGN_UP_ERRORS.has(error.code) ? error.code : "other";
    redirect(`/signup?error=${key}`);
  }

  // If Supabase asks for email confirmation, there is no session yet.
  if (!data.session) redirect("/login?check=1");

  redirect("/my");
}
