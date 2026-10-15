import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { PaidBadge, StageBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isServiceType, isStage, nextStage, prevStage, stepsFor } from "@/lib/loads";
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
  if (!load || !isServiceType(load.service_type) || !isStage(load.stage)) {
    notFound();
  }

  const steps = stepsFor(load.service_type);
  const next = nextStage(load.service_type, load.stage);
  const prev = prevStage(load.service_type, load.stage);

  const current = steps.indexOf(load.stage);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <Link
          href="/"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All loads
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{load.customer_name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={load.stage} />
            <PaidBadge isPaid={load.is_paid} />
            <span className="text-sm text-muted-foreground">{load.service_type}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="flex flex-col">
              {steps.map((stage, i) => {
                const done = i < current;
                const isCurrent = i === current;
                return (
                  <li key={stage} className="flex items-center gap-3 py-1.5">
                    <span
                      className={
                        done
                          ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          : isCurrent
                            ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-semibold text-primary"
                            : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs text-muted-foreground"
                      }
                    >
                      {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                    </span>
                    <span
                      className={
                        isCurrent
                          ? "font-semibold"
                          : done
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      {stage}
                      {isCurrent && <span className="sr-only"> (current step)</span>}
                    </span>
                  </li>
                );
              })}
            </ol>

            {next ? (
              <form action={moveStage}>
                <input type="hidden" name="id" value={load.id} />
                <input type="hidden" name="service" value={load.service_type} />
                <input type="hidden" name="from" value={load.stage} />
                <input type="hidden" name="direction" value="next" />
                <Button type="submit" size="lg" className="w-full">
                  Move to {next}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Released. This load has finished every step.
              </p>
            )}

            {prev && (
              <form action={moveStage}>
                <input type="hidden" name="id" value={load.id} />
                <input type="hidden" name="service" value={load.service_type} />
                <input type="hidden" name="from" value={load.stage} />
                <input type="hidden" name="direction" value="back" />
                <Button type="submit" variant="outline" className="w-full">
                  Back one step (to {prev})
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
    </>
  );
}
