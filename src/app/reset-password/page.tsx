import Link from "next/link";
import { Notice } from "@/components/rps/notice";
import { Logo } from "@/components/rps/logo";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULE } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";
import { setNewPassword } from "../login/actions";

const MESSAGES: Record<string, string> = {
  short: `That password is too easy to guess. ${PASSWORD_RULE} Not a well-known one like password1.`,
  mismatch: "The two passwords don't match.",
  same: "Choose a password different from your old one.",
  other: "Could not save the new password. Ask for a new link and try again.",
};

// Reached from the reset link in the email (via /auth/confirm), which
// signs the person in for a short while so they can choose a new password.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await searchParams;
  const message = typeof error === "string" ? (MESSAGES[error] ?? MESSAGES.other) : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <form action={setNewPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
                <p className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Type it again</Label>
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
              </div>
              {message && (
                <Notice tone="error" className="mb-0">{message}</Notice>
              )}
              <SubmitButton size="lg">Save new password</SubmitButton>
            </form>
          ) : (
            <Notice tone="error" className="mb-0">
              This page only works from a reset link, and the link may have expired.{" "}
              <Link href="/forgot" className="font-bold underline">
                Ask for a new one
              </Link>
              .
            </Notice>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
