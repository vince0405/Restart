"use server";

// The main Admin (Ticket 34): adds cooperatives and each one's first
// Chairperson. The database lets only people in the admins table do this
// (supabase/sql/018), and gives the Admin no access to any co-op's jobs,
// money or people.

import { redirect } from "next/navigation";
import { normalizePhMobile, parseOptionalEmail, phoneSignInEmail } from "@/lib/phone";
import { getSession } from "@/lib/session";
import { createAccount } from "@/lib/supabase/new-account";

async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) redirect("/");
  return session;
}

/** Make a new account (mobile + starting password) the co-op's Chairperson. */
async function addChair(coopId: string, formData: FormData): Promise<string | null> {
  const { supabase } = await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = normalizePhMobile(formData.get("phone"));
  const contactEmail = parseOptionalEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!fullName || fullName.length > 120) return "name_missing";
  if (!phone) return "phone_invalid";
  if (contactEmail === false) return "email_invalid";
  if (password.length < 8) return "password_short";

  const { data, error } = await createAccount({
    signInEmail: phoneSignInEmail(phone),
    password,
    fullName,
    phone,
    contactEmail,
    coopId,
  });
  if (error) return error.code === "user_already_exists" ? "phone_taken" : "save_failed";
  if (!data.user || data.user.identities?.length === 0) return "phone_taken";

  const { error: roleError } = await supabase.rpc("admin_make_chairperson", {
    target: data.user.id,
    coop: coopId,
  });
  return roleError ? "role_failed" : null;
}

/** A new cooperative, with its first Chairperson. */
export async function addCooperative(formData: FormData) {
  const { supabase } = await requireAdmin();

  const name = String(formData.get("coop_name") ?? "").trim();
  const town = String(formData.get("town") ?? "").trim().slice(0, 120);
  if (!name || name.length > 120) redirect("/admin?error=coop_name");

  const { data, error } = await supabase.from("cooperatives").insert({ name, town }).select("id").single();
  if (error || !data) redirect("/admin?error=save_failed");

  const problem = await addChair(data.id as string, formData);
  // The co-op exists either way; a failed Chairperson can be added again below.
  if (problem) redirect(`/admin?error=${problem}&coop=${data.id}`);
  redirect("/admin?added=1");
}

/** Another Chairperson for an existing co-op (e.g. if the first try failed). */
export async function addChairperson(formData: FormData) {
  await requireAdmin();
  const coopId = String(formData.get("coop_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(coopId)) redirect("/admin?error=save_failed");

  const problem = await addChair(coopId, formData);
  if (problem) redirect(`/admin?error=${problem}&coop=${coopId}`);
  redirect("/admin?added=1");
}
