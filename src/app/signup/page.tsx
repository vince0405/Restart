import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/rps/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { signUp } from "../login/actions";

const MESSAGES: Record<string, string> = {
  name: "Please enter your name.",
  user_already_exists: "That email already has an account. Sign in instead.",
  weak_password: "Choose a longer password (at least 6 characters).",
  signup_disabled: "Sign-ups are switched off right now. Please ask the co-op.",
  email_address_invalid: "That email address doesn't look right.",
  other: "Something went wrong. Please try again.",
};

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const message = typeof error === "string" ? (MESSAGES[error] ?? MESSAGES.other) : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create an account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Request drying or milling from Batad Multipurpose Cooperative and follow your
            palay from your phone.
          </p>
        </CardHeader>
        <CardContent>
          <form action={signUp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" autoComplete="name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0917 123 4567"
              />
            </div>
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
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            {message && (
              <p
                className="rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
                role="alert"
              >
                {message}
              </p>
            )}

            <Button type="submit" size="lg">
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-brand">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
