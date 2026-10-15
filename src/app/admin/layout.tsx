import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// Checks who is signed in BEFORE the loading screen is sent, so signed-out
// visitors and non-admins get a proper redirect at once (Ticket 42), the
// same way the co-op screens do in app/(app)/layout.tsx.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = await getSession();
  if (!isAdmin) redirect("/");
  return children;
}
