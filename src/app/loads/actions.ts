"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLoadInput } from "@/lib/loads";

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

  const { error } = await supabase.from("loads").insert(parsed.value);
  if (error) {
    redirect(`/loads/new?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}
