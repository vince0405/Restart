import { ErrorNote } from "@/components/rps/error-note";
import { PageTitle } from "@/components/rps/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { changePassword } from "./actions";

// Everyone: who you are, and a new password (e.g. after the Chairperson
// created your account with a starting password).
export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const { user, profile } = await getSession();
  const { error, saved } = await searchParams;

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Account" title={profile.full_name || "My account"} description={user.email ?? ""} />

      <div className="mb-6 rounded-2xl border border-line bg-white p-5 text-sm shadow-card">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Role</span>
          <span className="font-bold text-ink">{ROLE_LABELS[profile.role]}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted-foreground">Co-op member</span>
          <span className="font-bold text-ink">{profile.is_member ? "Yes" : "No"}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Only the Chairperson can change roles and membership.
        </p>
      </div>

      {saved && (
        <p className="mb-4 rounded-xl border-l-4 border-brand bg-brand-soft p-3 text-sm font-semibold text-brand">
          Password changed.
        </p>
      )}
      <ErrorNote code={error} />

      <form action={changePassword} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="font-extrabold text-ink">Change password</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Type it again</Label>
          <Input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <Button type="submit" className="self-start">
          Save new password
        </Button>
      </form>
    </div>
  );
}
