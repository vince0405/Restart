import Link from "next/link";
import { Notice } from "@/components/rps/notice";
import { Logo } from "@/components/rps/logo";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "../login/actions";

// Forgot password (Ticket 36, part 1). Works for accounts that sign in with
// an email. Mobile-number accounts ask the Chairperson (People page) until
// text messages are set up (Ticket 33).
export default async function ForgotPage({ searchParams }: PageProps<"/forgot">) {
  const { sent, phone, error, expired } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the email you sign in with. We&rsquo;ll send a link to choose a new password.
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Notice tone="success" className="mb-0">
              If that email has an account, a reset link is on its way. Check your inbox (and spam)
              and open the link on this same phone or computer.
            </Notice>
          ) : (
            <form action={requestPasswordReset} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="text" inputMode="email" autoComplete="email" maxLength={254} required />
              </div>
              {phone && (
                <Notice tone="info" className="mb-0">
                  If you sign in with a mobile number, please ask the co-op&rsquo;s Chairperson to
                  reset your password.
                </Notice>
              )}
              {error && (
                <Notice tone="error" className="mb-0">That email address doesn&rsquo;t look right.</Notice>
              )}
              {expired && (
                <Notice tone="error" className="mb-0">
                  That link has expired or was already used. Ask for a new one.
                </Notice>
              )}
              <SubmitButton size="lg">Send reset link</SubmitButton>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Sign in with a mobile number? Ask the Chairperson to reset your password.
          </p>
          <p className="mt-2 text-center text-sm">
            <Link href="/login" className="font-bold text-brand">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
