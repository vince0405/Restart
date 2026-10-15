import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

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
    .select("id, customer_name, sacks, stage, is_paid")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Loads</h1>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          Could not load the list: {error.message}
        </p>
      )}

      {loads && loads.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No loads yet.
          </CardContent>
        </Card>
      )}

      {loads && loads.length > 0 && (
        <ul className="flex flex-col gap-3">
          {loads.map((load) => (
            <li key={load.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{load.customer_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {load.sacks} sacks · {load.stage}
                    </span>
                  </div>
                  <span
                    className={
                      load.is_paid
                        ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                        : "rounded-full border border-border px-3 py-1 text-xs font-medium"
                    }
                  >
                    {load.is_paid ? "Paid" : "Not paid"}
                  </span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <form action={signOut} className="mt-auto border-t border-border pt-6">
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </main>
  );
}
