import { redirect } from "next/navigation";
import { ErrorNote } from "@/components/rps/error-note";
import { Logo } from "@/components/rps/logo";
import { Notice } from "@/components/rps/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { PASSWORD_RULE } from "@/lib/password";
import { getSession } from "@/lib/session";
import { changePassword } from "../(app)/account/actions";
import { signOut } from "../actions";

// Security fix 3: someone else (the Chairperson or the Admin) chose this
// account's starting password and passed it on. Every signed-in screen
// sends the person here until they pick their own (supabase/sql/025).
// Outside the (app) folder, so its layout doesn't send them round in circles.
export default async function ChangePasswordPage({ searchParams }: PageProps<"/change-password">) {
  const { profile } = await getSession();
  if (!profile.must_change_password) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Choose your own password</CardTitle>
        </CardHeader>
        <CardContent>
          <Notice tone="info">
            Your account was made with a starting password that someone else knows. Choose your own before
            you go on.
          </Notice>
          <ErrorNote code={error} />
          <form action={changePassword} className="flex flex-col gap-4">
            <input type="hidden" name="first" value="1" />
            <div className="flex flex-col gap-2">
              <Label htmlFor="current">Starting password</Label>
              <Input id="current" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
              <p className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">Type it again</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <SubmitButton size="lg">Save my password</SubmitButton>
          </form>
          <form action={signOut} className="mt-4 flex justify-center">
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
