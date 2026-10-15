import { redirect } from "next/navigation";
import { Logo } from "@/components/rps/logo";
import { Notice } from "@/components/rps/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSession } from "@/lib/session";
import { signOut } from "../actions";

// For a signed-in account that isn't linked to any co-op (Ticket 42). Every
// co-op page and action sends them here, so nothing runs without a co-op.
export default async function NoCoopPage() {
  const { profile, isAdmin } = await getSession();
  if (isAdmin) redirect("/admin");
  if (profile.coop_id) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>
      <Notice tone="info" title="Your account isn't linked to a cooperative">
        Please ask your cooperative&rsquo;s Chairperson or the RPS1 admin to add you.
      </Notice>
      <form action={signOut} className="self-center">
        <SubmitButton variant="outline">Sign out</SubmitButton>
      </form>
    </main>
  );
}
