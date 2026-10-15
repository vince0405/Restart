"use server";

import { redirect } from "next/navigation";
import { normalizePhMobile, parseOptionalEmail, phoneSignInEmail, signInEmailFor } from "@/lib/phone";
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

  // The account signs in with its mobile number (as an internal name). The
  // name, phone and optional email travel as "metadata"; the database copies
  // them into the new profile. The role is NOT sent: every new account is a
  // customer.
  const { data, error } = await supabase.auth.signUp({
    email: phoneSignInEmail(phone),
    password: String(formData.get("password") ?? ""),
    options: {
      data: { full_name: fullName.slice(0, 120), phone, contact_email: contactEmail },
    },
  });

  if (error) redirect(`/signup?error=${(error.code && SIGN_UP_ERRORS[error.code]) || "other"}`);

  // If Supabase were set to confirm emails, there would be no session yet —
  // and phone accounts have no inbox, so tell them to ask the co-op.
  if (!data.session) redirect("/login?check=1");

  redirect("/my");
}
