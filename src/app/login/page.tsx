import { redirect } from "next/navigation";
import { Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Already signed in? Go straight to the loads list.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Wheat className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">RPS1</h1>
        <p className="text-sm text-muted-foreground">
          Every palay load, from intake to payment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                Wrong email or password. Please try again.
              </p>
            )}

            <Button type="submit" size="lg">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
