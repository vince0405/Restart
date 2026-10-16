import { redirect } from "next/navigation";
import { Logo } from "@/components/rps/logo";
import { Notice } from "@/components/rps/notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSession } from "@/lib/session";
import { signOut } from "../actions";
import { joinCooperative } from "./actions";

const MESSAGES: Record<string, string> = {
  coop: "Choose your cooperative from the list.",
  failed: "Could not save your cooperative. If you already chose one, sign out and in again.",
};

// For a signed-in account that isn't linked to any co-op (Ticket 42). Every
// co-op page and action sends them here, so nothing runs without a co-op.
// The co-op is optional at sign-up (supabase/sql/026), so a Customer who
// skipped it chooses it here. Staff are always added to a co-op.
export default async function NoCoopPage({ searchParams }: PageProps<"/no-coop">) {
  const { supabase, profile, isAdmin } = await getSession();
  if (isAdmin) redirect("/admin");
  if (profile.coop_id) redirect("/");

  const { error } = await searchParams;
  const message = typeof error === "string" ? (MESSAGES[error] ?? MESSAGES.failed) : null;

  // The co-ops to choose from (names and towns only).
  const { data: coops } = profile.role === "customer" ? await supabase.rpc("list_cooperatives") : { data: [] };
  const cooperatives = (coops ?? []) as { id: string; name: string; town: string }[];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>

      {cooperatives.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Choose your cooperative</CardTitle>
            <p className="text-sm text-muted-foreground">
              The co-op that harvests, dries or mills your palay. You need one to request a service.
            </p>
          </CardHeader>
          <CardContent>
            <form action={joinCooperative} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="coop_id">Your cooperative</Label>
                <Select
                  id="coop_id"
                  name="coop_id"
                  required
                  defaultValue={cooperatives.length === 1 ? cooperatives[0].id : ""}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {cooperatives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.town ? ` (${c.town})` : ""}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  You can&rsquo;t change it yourself later, so pick the right one.
                </p>
              </div>
              {message && (
                <Notice tone="error" className="mb-0">{message}</Notice>
              )}
              <SubmitButton size="lg">Continue</SubmitButton>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Notice tone="info" title="Your account isn't linked to a cooperative">
          Please ask your cooperative&rsquo;s Chairperson or the RPS1 admin to add you.
        </Notice>
      )}

      <form action={signOut} className="self-center">
        <SubmitButton variant="outline">Sign out</SubmitButton>
      </form>
    </main>
  );
}
