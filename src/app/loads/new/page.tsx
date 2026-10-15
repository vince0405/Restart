import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SERVICE_TYPES } from "@/lib/loads";
import { createClient } from "@/lib/supabase/server";
import { createLoad } from "../actions";

export default async function NewLoadPage({
  searchParams,
}: PageProps<"/loads/new">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await searchParams;

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

        <h1 className="text-2xl font-semibold tracking-tight">New load</h1>

        <Card>
          <CardContent className="pt-6">
            <form action={createLoad} className="flex flex-col gap-4">
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="customer_name">Customer name</Label>
                <Input
                  id="customer_name"
                  name="customer_name"
                  type="text"
                  required
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sacks">Sacks</Label>
                <Input
                  id="sacks"
                  name="sacks"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="kilos">Kilos</Label>
                <Input
                  id="kilos"
                  name="kilos"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="service_type">Service type</Label>
                <Select
                  id="service_type"
                  name="service_type"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Choose a service…
                  </option>
                  {SERVICE_TYPES.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="agreed_price">Agreed price (₱)</Label>
                <Input
                  id="agreed_price"
                  name="agreed_price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  required
                />
              </div>

              <div className="mt-2 flex items-center gap-3">
                <Button type="submit" size="lg">
                  Save load
                </Button>
                <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                  Cancel
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
