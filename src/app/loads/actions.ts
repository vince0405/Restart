"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  firstStage,
  isServiceType,
  isStage,
  nextStage,
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
 */
export async function moveStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const service = String(formData.get("service") ?? "");
  const from = String(formData.get("from") ?? "");
  const direction = formData.get("direction");

  if (!isServiceType(service) || !isStage(from)) redirect(`/loads/${id}`);

  const to =
    direction === "back" ? prevStage(service, from) : nextStage(service, from);
  if (!to) redirect(`/loads/${id}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("loads")
    .update({ stage: to })
    .eq("id", id)
    .eq("service_type", service)
    .eq("stage", from);

  if (error) {
    redirect(`/loads/${id}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/loads/${id}`);
}
