"use server";

// Staff actions on jobs. Every action checks the person's role here AND the
// database checks it again (RLS plus the loads_guard triggers in
// supabase/sql/004 and 005), so a hidden button is never the only lock.
//
// Errors go back to the page as short codes (?error=not_allowed), never as
// raw text: see src/lib/errors.ts.

import { redirect } from "next/navigation";
import { codeForDbError, type ErrorCode } from "@/lib/errors";
import {
  countsAfter,
  firstStage,
  isServiceType,
  isStage,
  nextStage,
  parseAmountPaid,
  parseCount,
  parseDisposition,
  parseHarvestAddress,
  parseLoadInput,
  prevStage,
} from "@/lib/loads";
import { canApproveBuyout, canManage, canWork } from "@/lib/roles";
import { requireRole } from "@/lib/session";

/** The job's page, with an optional error code. */
function jobPath(id: string, code?: ErrorCode) {
  const path = `/loads/${encodeURIComponent(id)}`;
  return code ? `${path}?error=${code}` : path;
}

/**
 * A walk-in job, typed in by a Monitor or the Chairperson. It starts as an
 * accepted job. owner_id is filled in by the database with whoever is
 * signed in; RLS refuses anyone who is not a manager.
 */
export async function createLoad(formData: FormData) {
  const { supabase } = await requireRole(canManage);

  const parsed = parseLoadInput({
    customer_name: formData.get("customer_name"),
    sacks: formData.get("sacks"),
    kilos: formData.get("kilos"),
    service_type: formData.get("service_type"),
    agreed_price: formData.get("agreed_price"),
  });
  if (!parsed.ok) redirect(`/loads/new?error=${parsed.error}`);

  const address = parseHarvestAddress(parsed.value.service_type, formData.get("harvest_address"));
  if (!address.ok) redirect(`/loads/new?error=${address.error}`);

  const { error } = await supabase.from("loads").insert({
    ...parsed.value,
    stage: firstStage(parsed.value.service_type),
    harvest_address: address.value,
  });
  if (error) redirect(`/loads/new?error=${codeForDbError(error)}`);

  redirect("/loads");
}

/**
 * Moves a job one step forward or one step back along its service's steps.
 *
 * The form sends the step the person was LOOKING AT ("from"), and the
 * update only happens if the job is still at that step. So a double tap on
 * a slow phone moves it once, not twice.
 *
 * "stored" says whether the job was stored at the mill, which adds a
 * Stored step before Released. Going back from Stored to Ready un-stores it.
 */
export async function moveStage(formData: FormData) {
  const { supabase } = await requireRole(canWork);
  const id = String(formData.get("id") ?? "");
  const service = String(formData.get("service") ?? "");
  const from = String(formData.get("from") ?? "");
  const stored = formData.get("stored") === "1";
  const forward = formData.get("direction") !== "back";

  if (!isServiceType(service) || !isStage(from)) redirect(jobPath(id, "not_changed"));

  const to = forward ? nextStage(service, from, stored) : prevStage(service, from, stored);
  if (!to) redirect(jobPath(id, "not_changed"));

  let changes: Record<string, unknown> =
    from === "Stored" && to === "Ready" ? { stage: to, stored_at: null } : { stage: to };

  // Leaving Harvesting or Drying forwards: the new sacks and weight are
  // required (after drying the palay is lighter and may fill fewer sacks).
  if (forward && countsAfter(from)) {
    const count = parseCount(formData.get("sacks"), formData.get("kilos"));
    if (!count.ok) redirect(jobPath(id, count.error));
    changes = { ...changes, ...count.value };
    // With the harvest count comes the day's palay price: the database
    // works out the harvesting fee from it (supabase/sql/009).
    if (from === "Harvesting") {
      const price = parseAmountPaid(formData.get("market_price_per_kg"));
      if (!price.ok) redirect(jobPath(id, "market_price_invalid"));
      changes.market_price_per_kg = price.value;
    }
  }

  let query = supabase
    .from("loads")
    .update(changes)
    .eq("id", id)
    .eq("service_type", service)
    .eq("stage", from);
  query = stored ? query.not("stored_at", "is", null) : query.is("stored_at", null);
  // Leaving Ready forwards needs the batch weighed AND the customer's
  // keep / sell / split choice (the database refuses it too).
  if (from === "Ready" && forward) {
    query = query.not("output_kg", "is", null).not("disposition", "is", null);
  }

  const { data, error } = await query.select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/**
 * Stores a Ready job's kept grain at the mill and starts its expiry clock.
 * Needs a weighed batch, the customer's choice, and something kept.
 */
export async function storeLoad(formData: FormData) {
  const { supabase } = await requireRole(canWork);
  const id = String(formData.get("id") ?? "");

  const { data, error } = await supabase
    .from("loads")
    .update({ stage: "Stored", stored_at: new Date().toISOString() })
    .eq("id", id)
    .eq("stage", "Ready")
    .is("stored_at", null)
    .not("output_kg", "is", null)
    .not("disposition", "is", null)
    // Something kept: a share above 0%, or a declined buyout (keeps all).
    .or("keep_percent.gt.0,buyout_status.eq.declined")
    .select("id");

  if (error || !data?.length) redirect(jobPath(id, error ? codeForDbError(error) : "nothing_kept"));

  redirect(jobPath(id));
}

/** Records the processing fee paid in cash. */
export async function markPaid(formData: FormData) {
  const { supabase } = await requireRole(canManage);
  const id = String(formData.get("id") ?? "");

  const amount = parseAmountPaid(formData.get("amount_paid"));
  if (!amount.ok) redirect(jobPath(id, amount.error));

  const { data, error } = await supabase
    .from("loads")
    .update({ is_paid: true, amount_paid: amount.value })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/**
 * Change the processing fee, e.g. for a discount. The price list fills it
 * in; this overrides it until the next count re-applies the price list.
 */
export async function updateFee(formData: FormData) {
  const { supabase } = await requireRole(canManage);
  const id = String(formData.get("id") ?? "");

  const fee = parseAmountPaid(formData.get("agreed_price"));
  if (!fee.ok) redirect(jobPath(id, fee.error));

  const { data, error } = await supabase
    .from("loads")
    .update({ agreed_price: fee.value })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/** Undo for a mistaken "Mark paid": back to Not paid, amount cleared. */
export async function markNotPaid(formData: FormData) {
  const { supabase } = await requireRole(canManage);
  const id = String(formData.get("id") ?? "");

  const { data, error } = await supabase
    .from("loads")
    .update({ is_paid: false, amount_paid: null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/**
 * Deletes a job entered by mistake. Only Monitors and the Chairperson can
 * delete (RLS "managers delete"), and the page asks "Are you sure?" first.
 */
export async function deleteLoad(formData: FormData) {
  const { supabase } = await requireRole(canManage);
  const id = String(formData.get("id") ?? "");

  const { data, error } = await supabase.from("loads").delete().eq("id", id).select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect("/loads");
}

/**
 * Accept a customer's request: set the processing fee and turn it into a
 * job. It already sits at its service's first step, so it simply appears
 * in Jobs. Only works while the request is still pending.
 */
export async function acceptRequest(formData: FormData) {
  const { supabase } = await requireRole(canManage);
  const id = String(formData.get("id") ?? "");

  const price = parseAmountPaid(formData.get("agreed_price"));
  if (!price.ok) redirect(`/requests?error=${price.error}`);

  const { data, error } = await supabase
    .from("loads")
    .update({ request_status: "accepted", agreed_price: price.value })
    .eq("id", id)
    .eq("request_status", "pending")
    .select("id");
  if (error || !data?.length) redirect(`/requests?error=${codeForDbError(error)}`);

  redirect(jobPath(id));
}

/** Reject a customer's request. The reason is shown to the customer. */
export async function rejectRequest(formData: FormData) {
  const { supabase } = await requireRole(canManage);
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reject_reason") ?? "").trim().slice(0, 300);

  if (!reason) redirect("/requests?error=reason_required");

  const { data, error } = await supabase
    .from("loads")
    .update({ request_status: "rejected", reject_reason: reason })
    .eq("id", id)
    .eq("request_status", "pending")
    .select("id");
  if (error || !data?.length) redirect(`/requests?error=${codeForDbError(error)}`);

  redirect("/requests");
}

/** Weigh the finished batch: kg of rice (or palay) that came out. */
export async function recordOutput(formData: FormData) {
  const { supabase } = await requireRole(canWork);
  const id = String(formData.get("id") ?? "");

  const weight = parseAmountPaid(formData.get("output_kg"));
  if (!weight.ok) redirect(jobPath(id, "weight_invalid"));

  const { data, error } = await supabase
    .from("loads")
    .update({ output_kg: weight.value })
    .eq("id", id)
    .eq("stage", "Ready")
    .is("disposition", null)
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/** Staff choose keep / sell / split on behalf of a walk-in customer. */
export async function setDisposition(formData: FormData) {
  const { supabase } = await requireRole(canManage);
  const id = String(formData.get("id") ?? "");

  const parsed = parseDisposition(formData.get("choice"), formData.get("keep_percent"));
  if (!parsed.ok) redirect(jobPath(id, parsed.error));

  const { data, error } = await supabase
    .from("loads")
    .update(parsed.value)
    .eq("id", id)
    .is("customer_id", null)
    .is("disposition", null)
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/**
 * Chairperson only: buy the offered grain at a price per kg. The net
 * payout (sale value minus the processing fee still owed) is worked out
 * by settlement() in src/lib/loads.ts, so every screen shows the same sum.
 */
export async function approveBuyout(formData: FormData) {
  const { supabase } = await requireRole(canApproveBuyout);
  const id = String(formData.get("id") ?? "");

  const price = parseAmountPaid(formData.get("price_per_kg"));
  if (!price.ok) redirect(jobPath(id, price.error));

  const { data, error } = await supabase
    .from("loads")
    .update({ buyout_status: "approved", price_per_kg: price.value })
    .eq("id", id)
    .eq("buyout_status", "requested")
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/** Chairperson only: the co-op won't buy; the customer claims everything. */
export async function declineBuyout(formData: FormData) {
  const { supabase } = await requireRole(canApproveBuyout);
  const id = String(formData.get("id") ?? "");

  const { data, error } = await supabase
    .from("loads")
    .update({ buyout_status: "declined" })
    .eq("id", id)
    .eq("buyout_status", "requested")
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}

/** Chairperson only: record that the net payout was handed to the customer. */
export async function markPayoutDone(formData: FormData) {
  const { supabase } = await requireRole(canApproveBuyout);
  const id = String(formData.get("id") ?? "");

  const { data, error } = await supabase
    .from("loads")
    .update({ payout_done_at: new Date().toISOString() })
    .eq("id", id)
    .eq("buyout_status", "approved")
    .is("payout_done_at", null)
    .select("id");
  if (error || !data?.length) redirect(jobPath(id, codeForDbError(error)));

  redirect(jobPath(id));
}
