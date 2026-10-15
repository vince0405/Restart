"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  firstStage,
  isServiceType,
  isStage,
  nextStage,
  parseAmountPaid,
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

  redirect("/");
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
    .is("stored_at", null);

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
