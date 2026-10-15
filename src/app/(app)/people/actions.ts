"use server";

import { redirect } from "next/navigation";
import { codeForDbError } from "@/lib/errors";
import { parseAmountPaid } from "@/lib/loads";
import { canManagePeople, isRole } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { createAccount } from "@/lib/supabase/new-account";

/**
 * Chairperson only: change someone's role or member flag. This calls the
 * database function set_person(), which refuses anyone who is not the
 * Chairperson — so even a hand-made request from a customer cannot
 * promote anybody.
 */
export async function updatePerson(formData: FormData) {
  const { supabase } = await requireRole(canManagePeople);
  const target = String(formData.get("id") ?? "");
  const role = formData.get("role");

  if (!isRole(role)) redirect("/people?error=role_invalid");

  const { error } = await supabase.rpc("set_person", {
    target,
    new_role: role,
    new_is_member: formData.get("is_member") === "on",
  });

  if (error) redirect(`/people?error=${codeForDbError(error)}`);
  redirect("/people?saved=1");
}

/** Chairperson only (RLS on settings): co-op name, farmgate price, cancel window. */
export async function updateSettings(formData: FormData) {
  const { supabase } = await requireRole(canManagePeople);

  const price = parseAmountPaid(formData.get("farmgate_price_per_kg"));
  if (!price.ok) redirect("/settings?error=price");

  const coopName = String(formData.get("coop_name") ?? "").trim().slice(0, 120);
  if (!coopName) redirect("/settings?error=name");

  // Whole hours from 1 to 24 (the database refuses anything else too).
  const windowHours = Number(String(formData.get("cancel_window_hours") ?? "").trim());
  if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > 24) {
    redirect("/settings?error=window");
  }

  const { data, error } = await supabase
    .from("settings")
    .update({
      farmgate_price_per_kg: price.value,
      coop_name: coopName,
      cancel_window_hours: windowHours,
    })
    .eq("id", 1)
    .select("id");

  if (error || !data?.length) redirect("/settings?error=save");
  redirect("/settings?saved=1");
}

/**
 * Chairperson only: create an account for someone and give it a role.
 *
 * No service_role key. The account is made with the ordinary public key
 * (like the sign-up page), so the database makes it a Customer; then the
 * Chairperson's own session calls set_person() — which the database only
 * allows for the Chairperson — to set the role. Give the person their
 * email and starting password, and ask them to change it under Account.
 */
export async function addPerson(formData: FormData) {
  const { supabase } = await requireRole(canManagePeople);

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role");
  const isMember = formData.get("is_member") === "on";

  if (!fullName || fullName.length > 120) redirect("/people?error=name_missing");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect("/people?error=email_invalid");
  if (password.length < 8) redirect("/people?error=password_short");
  if (!isRole(role)) redirect("/people?error=role_invalid");

  const { data, error } = await createAccount({ email, password, fullName, phone });

  if (error) {
    const code =
      error.code === "user_already_exists"
        ? "email_taken"
        : error.code === "weak_password"
          ? "password_short"
          : error.code === "email_address_invalid"
            ? "email_invalid"
            : error.code === "signup_disabled"
              ? "signup_disabled"
              : error.code?.startsWith("over_")
                ? "too_many_tries"
                : "save_failed";
    redirect(`/people?error=${code}`);
  }
  // Supabase hides "email already used" in some settings by returning a
  // user with no identities instead of an error.
  if (!data.user || data.user.identities?.length === 0) redirect("/people?error=email_taken");

  if (role !== "customer" || isMember) {
    const { error: roleError } = await supabase.rpc("set_person", {
      target: data.user.id,
      new_role: role,
      new_is_member: isMember,
    });
    if (roleError) redirect("/people?error=role_failed");
  }

  redirect("/people?added=1");
}
