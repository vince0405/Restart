"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  firstStage,
  isServiceType,
  isStage,
  nextStage,
  parseAmountPaid,
  parseDisposition,
  parseLoadInput,
  prevStage,
} from "@/lib/loads";

/**
 * Runs on the server when the "New load" form is submitted. It checks the
 * input, saves the load, and sends the Monitor back to the list.
 *
 * owner_id is not sent here: the database fills it in with whoever is
 * signed in (default auth.uid()), and Row Level Security refuses anything
 * else.
 */
export async function createLoad(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parseLoadInput({
    customer_name: formData.get("customer_name"),
    sacks: formData.get("sacks"),
    kilos: formData.get("kilos"),
    service_type: formData.get("service_type"),
    agreed_price: formData.get("agreed_price"),
  });

  if (!parsed.ok) {
    redirect(`/loads/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const { error } = await supabase.from("loads").insert({
    ...parsed.value,
    stage: firstStage(parsed.value.service_type),
  });
  if (error) {
    redirect(`/loads/new?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/loads");
}

/**
 * Moves a load one step forward or one step back along its service's steps.
 *
 * The form sends the step the Monitor was LOOKING AT ("from"), and the
 * update only happens if the load is still at that step. So a double tap
 * on a slow phone moves the load once, not twice.
 *
 * "stored" says whether the load was stored at the mill, which adds a
 * Stored step before Released. Going back from Stored to Ready un-stores it.
 */
export async function moveStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const service = String(formData.get("service") ?? "");
  const from = String(formData.get("from") ?? "");
  const stored = formData.get("stored") === "1";
  const direction = formData.get("direction");

  if (!isServiceType(service) || !isStage(from)) redirect(`/loads/${id}`);

  const to =
    direction === "back"
      ? prevStage(service, from, stored)
      : nextStage(service, from, stored);
  if (!to) redirect(`/loads/${id}`);

  const changes =
    from === "Stored" && to === "Ready"
      ? { stage: to, stored_at: null }
      : { stage: to };

  const supabase = await createClient();
  let query = supabase
    .from("loads")
    .update(changes)
    .eq("id", id)
    .eq("service_type", service)
    .eq("stage", from);
  // Leaving Ready (releasing) needs the batch weighed first.
  if (from === "Ready" && direction !== "back") query = query.not("output_kg", "is", null);
  query = stored
    ? query.not("stored_at", "is", null)
    : query.is("stored_at", null);
  const { error } = await query;

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/**
 * Stores a Ready load at the mill and starts its expiry clock. Only works
 * while the load is still Ready and not already stored.
 */
export async function storeLoad(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ stage: "Stored", stored_at: new Date().toISOString() })
    .eq("id", id)
    .eq("stage", "Ready")
    .is("stored_at", null)
    .not("output_kg", "is", null);

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/** Marks a load paid with the amount the customer actually handed over. */
export async function markPaid(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const parsed = parseAmountPaid(formData.get("amount_paid"));
  if (!parsed.ok) {
    redirect(`/loads/${id}?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ is_paid: true, amount_paid: parsed.value })
    .eq("id", id);

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/** Undo for a mistaken "Mark paid": back to Not paid, amount cleared. */
export async function markNotPaid(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ is_paid: false, amount_paid: null })
    .eq("id", id);

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/**
 * Deletes a load entered by mistake. The detail screen only shows the
 * button that calls this after the Monitor has said "Yes, delete".
 * RLS means a Monitor can only ever delete their own loads.
 */
export async function deleteLoad(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("loads").delete().eq("id", id);

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/loads");
}

/**
 * Accept a customer's request: set the processing fee and turn it into a
 * job. It already sits at its service's first step, so it simply appears
 * in Jobs. Only works while the request is still pending.
 */
export async function acceptRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const price = parseAmountPaid(formData.get("agreed_price"));
  if (!price.ok) {
    redirect(`/requests?error=${encodeURIComponent("Enter the processing fee (0 or more).")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ request_status: "accepted", agreed_price: price.value })
    .eq("id", id)
    .eq("request_status", "pending");

  if (error) {
    redirect(`/requests?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/** Reject a customer's request. The reason is shown to the customer. */
export async function rejectRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reject_reason") ?? "").trim().slice(0, 300);

  if (!reason) {
    redirect(`/requests?error=${encodeURIComponent("Give the customer a reason for rejecting.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ request_status: "rejected", reject_reason: reason })
    .eq("id", id)
    .eq("request_status", "pending");

  if (error) {
    redirect(`/requests?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/requests");
}

/** Weigh the finished batch: kg of rice (or palay) that came out. */
export async function recordOutput(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const weight = parseAmountPaid(formData.get("output_kg"));
  if (!weight.ok) {
    redirect(`/loads/${id}?error=${encodeURIComponent("Enter the output weight in kg (0 or more).")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ output_kg: weight.value })
    .eq("id", id)
    .eq("stage", "Ready");

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/** Staff choose keep / sell / split on behalf of a walk-in customer. */
export async function setDisposition(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const parsed = parseDisposition(formData.get("choice"), formData.get("keep_percent"));
  if (!parsed.ok) {
    redirect(`/loads/${id}?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update(parsed.value)
    .eq("id", id)
    .is("customer_id", null)
    .is("disposition", null);

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/**
 * Chairperson only: buy the offered grain at a price per kg. The net
 * payout (sale value minus the processing fee still owed) is worked out
 * by settlement() in src/lib/loads.ts, so every screen shows the same sum.
 */
export async function approveBuyout(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const price = parseAmountPaid(formData.get("price_per_kg"));
  if (!price.ok) {
    redirect(`/loads/${id}?error=${encodeURIComponent("Enter the price per kg (0 or more).")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ buyout_status: "approved", price_per_kg: price.value })
    .eq("id", id)
    .eq("buyout_status", "requested");

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/** Chairperson only: the co-op won't buy; the customer claims everything. */
export async function declineBuyout(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ buyout_status: "declined" })
    .eq("id", id)
    .eq("buyout_status", "requested");

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}

/** Chairperson only: record that the net payout was handed to the customer. */
export async function markPayoutDone(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ payout_done_at: new Date().toISOString() })
    .eq("id", id)
    .eq("buyout_status", "approved")
    .is("payout_done_at", null);

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}
