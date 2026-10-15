import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus, Wheat } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PaidBadge, StageBadge } from "@/components/badges";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// The loads list: the Monitor's home screen.
export default async function LoadsPage() {
  const supabase = await createClient();

  // Not signed in? Only the sign-in screen is allowed.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // No "where owner_id = ..." needed: Row Level Security only ever hands
  // back the signed-in Monitor's own loads.
  const { data: loads, error } = await supabase
    .from("loads")
    .select("id, customer_name, sacks, service_type, stage, is_paid")
    .order("created_at", { ascending: false });

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Loads</h1>
            {loads && loads.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {loads.length} {loads.length === 1 ? "load" : "loads"}
              </p>
            )}
          </div>
          <Link href="/loads/new" className={buttonVariants({ size: "lg" })}>
            <Plus className="h-5 w-5" aria-hidden />
            New load
          </Link>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            Could not load the list: {error.message}
          </p>
        )}

        {loads && loads.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Wheat className="h-6 w-6" aria-hidden />
              </span>
              <p className="font-medium">No loads yet</p>
              <p className="text-sm text-muted-foreground">
                Tap &ldquo;New load&rdquo; when a customer&rsquo;s job starts.
              </p>
            </CardContent>
          </Card>
        )}

        {loads && loads.length > 0 && (
          <ul className="flex flex-col gap-3">
            {loads.map((load) => (
              <li key={load.id}>
                <Link href={`/loads/${load.id}`} className="block rounded-[var(--radius)]">
                  <Card className="transition-colors hover:bg-secondary active:bg-secondary">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-base font-semibold">
                            {load.customer_name}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {load.sacks} {load.sacks === 1 ? "sack" : "sacks"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StageBadge stage={load.stage} />
                          <PaidBadge isPaid={load.is_paid} />
                          <span className="text-xs text-muted-foreground">
                            {load.service_type}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
