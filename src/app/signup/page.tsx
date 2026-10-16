import Link from "next/link";
import { Notice } from "@/components/rps/notice";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/rps/back-link";
import { Logo } from "@/components/rps/logo";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PASSWORD_RULE } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";
import { signUp } from "../login/actions";

const MESSAGES: Record<string, string> = {
  name: "Please enter your name.",
  phone_taken: "That mobile number already has an account. Sign in instead.",
  phone_invalid: "Enter a Philippine mobile number, like 0917 123 4567.",
  weak_password: `That password is too easy to guess. ${PASSWORD_RULE} Not a well-known one like password1, and not your mobile number.`,
  signup_disabled: "Sign-ups are switched off right now. Please ask the co-op.",
  email_address_invalid: "That email address doesn't look right.",
  coop: "Choose your cooperative.",
  other: "Something went wrong. Please try again.",
};

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  // The co-ops to choose from (names and towns only).
  const { data: coops } = await supabase.rpc("list_cooperatives");
  const cooperatives = (coops ?? []) as { id: string; name: string; town: string }[];
  const message = typeof error === "string" ? (MESSAGES[error] ?? MESSAGES.other) : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <BackLink />
      <div className="flex justify-center">
        <Link href="/" aria-label="RPS1 home — what is RPS1?">
          <Logo />
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create an account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Request harvesting, drying or milling from your cooperative and follow your
            palay from your phone.
          </p>
        </CardHeader>
        <CardContent>
          <form action={signUp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="coop_id">Your cooperative (optional)</Label>
              <Select id="coop_id" name="coop_id" defaultValue={cooperatives.length === 1 ? cooperatives[0].id : ""}>
                <option value="">Choose later</option>
                {cooperatives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.town ? ` (${c.town})` : ""}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Not sure yet? You can choose it after you sign in. You need one to request a service.
              </p>
            </div>
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
                required
              />
              <p className="text-xs text-muted-foreground">You&rsquo;ll use this to sign in.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" name="email" type="email" autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>
            </div>

            {message && (
              <Notice tone="error" className="mb-0">{message}</Notice>
            )}

            <SubmitButton size="lg">
              Create account
            </SubmitButton>
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
