"use server";

import { redirect } from "next/navigation";
import { codeForDbError } from "@/lib/errors";
import { firstStage, parseDisposition, parseHarvestAddress, parseLoadInput } from "@/lib/loads";
import { normalizePhMobile } from "@/lib/phone";
import { isStaff } from "@/lib/roles";
import { requireRole } from "@/lib/session";

const isCustomer = (r: Parameters<typeof isStaff>[0]) => !isStaff(r);

/**
 * A customer asks the co-op for a service. It is saved as a PENDING
 * request for this customer only; staff accept or reject it later.
 *
 * The database double-checks all of this (the loads_guard_insert trigger
 * forces customer_id, "pending", price 0 ...), so a tampered form cannot
 * create an accepted job or one for someone else.
 */
export async function requestService(formData: FormData) {
  const { supabase, user } = await requireRole(isCustomer);

  // Who the co-op should ask for, and a number they can call (Ticket 40).
  // Both are required; the form fills them in from the account.
  const contactName = String(formData.get("customer_name") ?? "").trim();
  if (!contactName || contactName.length > 120) redirect("/my/request?error=contact_name_required");
  const contactPhone = normalizePhMobile(formData.get("contact_phone"));
  if (!contactPhone) redirect("/my/request?error=contact_phone_invalid");

  const parsed = parseLoadInput({
    customer_name: contactName,
    sacks: formData.get("sacks"),
    kilos: formData.get("kilos"),
    service_type: formData.get("service_type"),
    agreed_price: 0,
  });
  if (!parsed.ok) redirect(`/my/request?error=${parsed.error}`);

  const address = parseHarvestAddress(parsed.value.service_type, formData.get("harvest_address"));
  if (!address.ok) redirect(`/my/request?error=${address.error}`);

  const preferred = String(formData.get("preferred_date") ?? "");
  const note = String(formData.get("customer_note") ?? "").trim().slice(0, 500);

  const { error } = await supabase.from("loads").insert({
    ...parsed.value,
    stage: firstStage(parsed.value.service_type),
    customer_id: user.id,
    request_status: "pending",
    preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(preferred) ? preferred : null,
    customer_note: note || null,
    harvest_address: address.value,
    contact_phone: contactPhone,
  });
  if (error) redirect(`/my/request?error=${codeForDbError(error)}`);

  redirect("/my");
}

/**
 * The customer decides what happens to their weighed, Ready grain: keep
 * all of it, sell all of it to the co-op, or split. Only allowed once, on
 * their own job — the loads_guard_update trigger refuses anything else.
 */
export async function chooseDisposition(formData: FormData) {
  const { supabase } = await requireRole(isCustomer);
  const id = String(formData.get("id") ?? "");
  const path = `/my/${encodeURIComponent(id)}`;

  const parsed = parseDisposition(formData.get("choice"), formData.get("keep_percent"));
  if (!parsed.ok) redirect(`${path}?error=${parsed.error}`);

  const { data, error } = await supabase
    .from("loads")
    .update(parsed.value)
    .eq("id", id)
    .is("disposition", null)
    .select("id");
  if (error || !data?.length) redirect(`${path}?error=${codeForDbError(error)}`);

  redirect(path);
}

/**
 * A customer cancels their own request while it is still pending and
 * inside the co-op's cancel window. The loads_guard_update trigger
 * (supabase/sql/006) is the real check: it uses the database's clock, sets
 * who and when itself, and refuses late, accepted or other people's
 * requests — whatever this form or the phone's clock says.
 */
export async function cancelRequest(formData: FormData) {
  const { supabase } = await requireRole(isCustomer);
  const id = String(formData.get("id") ?? "");
  const path = `/my/${encodeURIComponent(id)}`;

  const { data, error } = await supabase
    .from("loads")
    .update({ request_status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("request_status", "pending")
    .select("id");

  // No row changed means it was not pending any more (or not theirs).
  if (error || !data?.length) {
    redirect(`${path}?error=${error ? codeForDbError(error) : "cancel_closed"}`);
  }

  redirect("/my");
}
