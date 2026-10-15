import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isStage, nextStage, prevStage, STAGES } from "@/lib/loads";
import { createClient } from "@/lib/supabase/server";
import { moveStage } from "../actions";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default async function LoadDetailPage({
  params,
  searchParams,
}: PageProps<"/loads/[id]">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { error } = await searchParams;

  // RLS means this only finds the load if it belongs to the signed-in
  // Monitor. Someone else's load (or a made-up id) is simply "not found".
  const { data: load } = await supabase
    .from("loads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!load || !isStage(load.stage)) notFound();

  const next = nextStage(load.stage);
  const prev = prevStage(load.stage);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/" className="text-sm text-muted-foreground">
        ← All loads
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">{load.customer_name}</h1>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stage: {load.stage}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ol className="flex flex-wrap gap-2 text-xs">
            {STAGES.map((stage, i) => (
              <li
                key={stage}
                className={
                  stage === load.stage
                    ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                    : i < STAGES.indexOf(load.stage)
                      ? "rounded-full border border-border px-3 py-1"
                      : "rounded-full px-3 py-1 text-muted-foreground"
                }
              >
                {stage}
              </li>
            ))}
          </ol>

          {next ? (
            <form action={moveStage}>
              <input type="hidden" name="id" value={load.id} />
              <input type="hidden" name="from" value={load.stage} />
              <input type="hidden" name="direction" value="next" />
              <Button type="submit" size="lg" className="w-full">
                Move to {next}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Released. This load has finished every stage.
            </p>
          )}

          {prev && (
            <form action={moveStage}>
              <input type="hidden" name="id" value={load.id} />
              <input type="hidden" name="from" value={load.stage} />
              <input type="hidden" name="direction" value="back" />
              <Button type="submit" variant="outline" size="sm">
                Back one stage (to {prev})
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Sacks</dt>
            <dd>{load.sacks}</dd>
            <dt className="text-muted-foreground">Kilos</dt>
            <dd>{load.kilos}</dd>
            <dt className="text-muted-foreground">Service</dt>
            <dd>{load.service_type}</dd>
            <dt className="text-muted-foreground">Agreed price</dt>
            <dd>{peso.format(load.agreed_price)}</dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd>
              {load.is_paid
                ? `Paid${load.amount_paid != null ? ` (${peso.format(load.amount_paid)})` : ""}`
                : "Not paid"}
            </dd>
            <dt className="text-muted-foreground">Logged</dt>
            <dd>
              {new Date(load.created_at).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
