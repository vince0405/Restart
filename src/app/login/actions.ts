"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePhMobile, parseOptionalEmail, phoneSignInEmail, signInEmailFor } from "@/lib/phone";
import { passwordProblem } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

// A server action: this runs on the server when the sign-in form is
// submitted, so the password never touches our own JavaScript in the browser.
//
// People type a mobile number OR (for older accounts) an email. A mobile
// number becomes its internal sign-in name — see src/lib/phone.ts.
export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = signInEmailFor(formData.get("identifier"));
  if (!email) redirect("/login?error=1");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get("password") ?? ""),
  });

  if (error) redirect("/login?error=1");

  redirect("/");
}

// The sign-up problems people actually hit; the sign-up page has a friendly
// message for each. Anything else shows a general message, so we never
// echo raw error text onto the page.
const SIGN_UP_ERRORS: Record<string, string> = {
  user_already_exists: "phone_taken",
  weak_password: "weak_password",
  signup_disabled: "signup_disabled",
};

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) redirect("/signup?error=name");

  const phone = normalizePhMobile(formData.get("phone"));
  if (!phone) redirect("/signup?error=phone_invalid");

  const contactEmail = parseOptionalEmail(formData.get("email"));
  if (contactEmail === false) redirect("/signup?error=email_address_invalid");

  // The one password rule, like everywhere else in RPS1 (src/lib/password.ts).
  if (passwordProblem(String(formData.get("password") ?? ""), phone)) redirect("/signup?error=weak_password");

  // Which co-op they are a customer of (Ticket 34). The database keeps it
  // only if it is a real co-op.
  const coopId = String(formData.get("coop_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(coopId)) redirect("/signup?error=coop");

  // The account signs in with its mobile number (as an internal name). The
  // name, phone and optional email travel as "metadata"; the database copies
  // them into the new profile. The role is NOT sent: every new account is a
  // customer.
  const { data, error } = await supabase.auth.signUp({
    email: phoneSignInEmail(phone),
    password: String(formData.get("password") ?? ""),
    options: {
      data: { full_name: fullName.slice(0, 120), phone, contact_email: contactEmail, coop_id: coopId },
    },
  });

  if (error) redirect(`/signup?error=${(error.code && SIGN_UP_ERRORS[error.code]) || "other"}`);

  // If Supabase were set to confirm emails, there would be no session yet —
  // and phone accounts have no inbox, so tell them to ask the co-op.
  if (!data.session) redirect("/login?check=1");

  redirect("/my");
}

/**
 * Forgot password (Ticket 36, part 1): Supabase emails a reset link. Only
 * accounts that sign in with a real email can get one; mobile-number
 * accounts have no inbox. The page says the same thing either way, so it
 * cannot be used to find out who has an account.
 */
export async function requestPasswordReset(formData: FormData) {
  const text = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!text.includes("@")) redirect("/forgot?phone=1");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || text.length > 254) redirect("/forgot?error=1");

  // The link comes back to this site. Supabase only allows addresses listed
  // under Authentication -> URL Configuration -> Redirect URLs.
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const supabase = await createClient();
  // The result is ignored on purpose: "no such account" must look the same.
  await supabase.auth.resetPasswordForEmail(text, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  redirect("/forgot?sent=1");
}

/** Choose a new password, from the reset link's short-lived session. */
export async function setNewPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (passwordProblem(password)) redirect("/reset-password?error=short");
  if (password !== String(formData.get("confirm") ?? "")) redirect("/reset-password?error=mismatch");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot?expired=1");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${error.code === "same_password" ? "same" : "other"}`);

  redirect("/");
}
