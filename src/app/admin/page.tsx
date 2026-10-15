import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { Logo } from "@/components/rps/logo";
import { Notice } from "@/components/rps/notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSession } from "@/lib/session";
import { signOut } from "../actions";
import { addChairperson, addCooperative } from "./actions";

const MESSAGES: Record<string, string> = {
  coop_name: "Enter the cooperative's name (up to 120 characters).",
  name_missing: "Enter the Chairperson's full name.",
  phone_invalid: "Enter a Philippine mobile number, like 0917 123 4567.",
  phone_taken: "That mobile number already has an account.",
  email_invalid: "That email address doesn't look right.",
  password_short: "The starting password must be at least 8 characters.",
  role_failed: "The account was made, but could not be made Chairperson.",
  save_failed: "Could not save. Please try again.",
};

type Coop = {
  id: string;
  name: string;
  town: string;
  created_at: string;
  chairpersons: string;
  people: number;
};

/** Name, mobile, optional email and starting password of a Chairperson. */
function ChairFields({ prefix }: { prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_name`}>Chairperson&rsquo;s full name</Label>
        <Input id={`${prefix}_name`} name="full_name" maxLength={120} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_phone`}>Their mobile number</Label>
        <Input id={`${prefix}_phone`} name="phone" type="tel" inputMode="tel" placeholder="0917 123 4567" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_email`}>Email (optional)</Label>
        <Input id={`${prefix}_email`} name="email" type="email" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_password`}>Starting password</Label>
        <Input id={`${prefix}_password`} name="password" type="text" minLength={8} autoComplete="off" required />
      </div>
    </div>
  );
}

// The main Admin (Ticket 34): every co-op using RPS1, and adding a new one
// with its first Chairperson. No jobs, money or people lists here — the
// database does not show them to the Admin.
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { supabase, isAdmin, profile } = await getSession();
  if (!isAdmin) redirect("/");

  const { error, added } = await searchParams;
  const { data, error: listError } = await supabase.rpc("admin_list_cooperatives");
  const coops = (data ?? []) as Coop[];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <form action={signOut}>
          <SubmitButton variant="outline" size="sm">
            Sign out
          </SubmitButton>
        </form>
      </div>

      <h1 className="text-2xl font-extrabold text-ink">Cooperatives</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as {profile.full_name || "the admin"}. Each co-op sees only its own people, jobs
        and money. You add co-ops and their first Chairperson; you can&rsquo;t see their jobs or money.
      </p>

      <div className="mt-6">
        {added && <Notice tone="success">Saved. Give the Chairperson their mobile number and starting password.</Notice>}
        {typeof error === "string" && <Notice tone="error">{MESSAGES[error] ?? MESSAGES.save_failed}</Notice>}
        {listError && <Notice tone="error">Could not load the co-ops. Has 018 been run in Supabase?</Notice>}
      </div>

      <ul className="flex flex-col gap-3">
        {coops.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Building2 className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-ink">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.town || "No town"} · {Number(c.people)} {Number(c.people) === 1 ? "person" : "people"} ·
                  Chairperson: {c.chairpersons || "none yet"}
                </div>
              </div>
            </div>
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer text-sm font-bold text-brand">
                Add a Chairperson
              </summary>
              <form action={addChairperson} className="mt-2 flex flex-col gap-3">
                <input type="hidden" name="coop_id" value={c.id} />
                <ChairFields prefix={`c${c.id.slice(0, 8)}`} />
                <SubmitButton variant="outline" className="sm:self-start">
                  Add Chairperson
                </SubmitButton>
              </form>
            </details>
          </li>
        ))}
      </ul>

      <form action={addCooperative} className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
        <h2 className="text-lg font-extrabold text-ink">Add a cooperative</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="coop_name">Cooperative name</Label>
            <Input id="coop_name" name="coop_name" maxLength={120} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="town">Town</Label>
            <Input id="town" name="town" maxLength={120} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          It starts with the standard price list; its Chairperson can change it in Settings.
        </p>
        <ChairFields prefix="new" />
        <SubmitButton size="lg" className="sm:self-start">
          Add cooperative
        </SubmitButton>
      </form>
    </main>
  );
}
