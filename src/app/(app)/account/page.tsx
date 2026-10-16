import { ErrorNote } from "@/components/rps/error-note";
import { Notice } from "@/components/rps/notice";
import { PageTitle } from "@/components/rps/page-title";
import { ThemeChoice } from "@/components/rps/theme-toggle";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULE } from "@/lib/password";
import { formatPhMobile, isPhoneSignInEmail } from "@/lib/phone";
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
      <PageTitle
        eyebrow="Account"
        title={profile.full_name || "My account"}
        description={
          // Phone accounts sign in with their mobile number; never show the
          // internal sign-in name.
          isPhoneSignInEmail(user.email)
            ? `Sign in with ${formatPhMobile(profile.phone)}`
            : `Sign in with ${user.email ?? ""}`
        }
      />

      <div className="mb-6 rounded-2xl border border-line bg-card p-5 text-sm shadow-card">
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
        <Notice tone="success">Password changed.</Notice>
      )}
      <ErrorNote code={error} />

      <section
        aria-labelledby="appearance"
        className="mb-6 rounded-2xl border border-line bg-card p-5 shadow-card"
      >
        <h2 id="appearance" className="font-extrabold text-ink">
          Appearance
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Dark mode is easier on the eyes at night. &ldquo;Phone setting&rdquo; follows your phone.
        </p>
        <ThemeChoice />
      </section>

      <form action={changePassword} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
        <h2 className="font-extrabold text-ink">Change password</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="current">Current password</Label>
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
          <p className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Type it again</Label>
          <Input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <SubmitButton className="self-start">
          Save new password
        </SubmitButton>
      </form>
    </div>
  );
}
