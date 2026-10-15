import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/rps/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Already signed in? Go straight in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error, check } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every palay load, from intake to payment.
          </p>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="identifier">Mobile number or email</Label>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder="0917 123 4567"
                required
              />
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

            {check && (
              <p className="rounded-xl border-l-4 border-brand bg-brand-soft p-3 text-sm font-semibold text-brand">
                Account created, but it still needs to be confirmed. Please ask the co-op.
              </p>
            )}

            {error && (
              <p
                className="rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
                role="alert"
              >
                Wrong mobile number, email or password. Please try again.
              </p>
            )}

            <Button type="submit" size="lg">
              Sign in
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link href="/signup" className="font-bold text-brand">
                Create an account
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
