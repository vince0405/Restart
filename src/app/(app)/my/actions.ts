"use server";

import { redirect } from "next/navigation";
import { firstStage, parseDisposition, parseLoadInput } from "@/lib/loads";
import { getSession } from "@/lib/session";

/**
 * A customer asks the co-op for a service. It is saved as a PENDING
 * request for this customer only; staff accept or reject it later.
 *
 * The database double-checks all of this (the loads_guard_insert trigger
 * forces customer_id, "pending", price 0 ...), so a tampered form cannot
 * create an accepted job or one for someone else.
 */
export async function requestService(formData: FormData) {
  const { supabase, user, profile } = await getSession();

  const parsed = parseLoadInput({
    customer_name: profile.full_name || formData.get("customer_name"),
    sacks: formData.get("sacks"),
    kilos: formData.get("kilos"),
    service_type: formData.get("service_type"),
    agreed_price: 0,
  });
  if (!parsed.ok) {
    redirect(`/my/request?error=${encodeURIComponent(parsed.error)}`);
  }

  const preferred = String(formData.get("preferred_date") ?? "");
  const note = String(formData.get("customer_note") ?? "").trim().slice(0, 500);

  const { error } = await supabase.from("loads").insert({
    ...parsed.value,
    stage: firstStage(parsed.value.service_type),
    customer_id: user.id,
    request_status: "pending",
    preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(preferred) ? preferred : null,
    customer_note: note || null,
  });

  if (error) {
    redirect(`/my/request?error=${encodeURIComponent("Could not send the request. Please try again.")}`);
  }

  redirect("/my");
}

/**
 * The customer decides what happens to their weighed, Ready grain: keep
 * all of it, sell all of it to the co-op, or split. Only allowed once, on
 * their own job — the loads_guard_update trigger refuses anything else.
 */
export async function chooseDisposition(formData: FormData) {
  const { supabase } = await getSession();
  const id = String(formData.get("id") ?? "");

  const parsed = parseDisposition(formData.get("choice"), formData.get("keep_percent"));
  if (!parsed.ok) {
    redirect(`/my/${id}?error=${encodeURIComponent(parsed.error)}`);
  }

  const { error } = await supabase
    .from("loads")
    .update(parsed.value)
    .eq("id", id)
    .is("disposition", null);

  if (error) {
    redirect(`/my/${id}?error=${encodeURIComponent("Could not save your choice. Please try again.")}`);
  }

  redirect(`/my/${id}`);
}
