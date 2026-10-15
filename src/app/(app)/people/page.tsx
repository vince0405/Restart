import Link from "next/link";
import { Notice } from "@/components/rps/notice";
import { BadgeCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/components/rps/error-note";
import { canManagePeople, isRole, ROLE_LABELS, ROLES } from "@/lib/roles";
import { formatPhMobile } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/session";
import { addPerson, updatePerson } from "./actions";

type Person = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  role: keyof typeof ROLE_LABELS;
  is_member: boolean;
};

// Chairperson only: add people, and set everyone's role and member flag.
export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const { supabase, user } = await requireRole(canManagePeople);
  const { error, saved, added, role: roleFilter } = await searchParams;
  const filter = isRole(roleFilter) ? roleFilter : null;

  const { data } = await supabase
    .from("profiles")
    .select("id, created_at, full_name, phone, role, is_member")
    .order("created_at", { ascending: false });
  const everyone = (data ?? []) as Person[];
  const people = filter ? everyone.filter((p) => p.role === filter) : everyone;
  const count = (r: string) => everyone.filter((p) => p.role === r).length;

  return (
    <div>
      <PageTitle
        eyebrow="Chairperson"
        title="People"
        description="Add staff and members, and change anyone's role. People who sign up themselves start as Customers."
      />

      {added && (
        <Notice tone="success">Account created. Give the person their mobile number and starting password, and ask
          them to change the password under Account after signing in.</Notice>
      )}
      {saved && (
        <Notice tone="success">Saved.</Notice>
      )}
      <ErrorNote code={error} />

      <section className="mb-6 rounded-2xl border border-line bg-card p-5 shadow-card md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <UserPlus className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-extrabold text-ink">Add a person</h2>
            <p className="text-xs text-muted-foreground">
              Creates their account with the role you choose. They can sign in straight away.
            </p>
          </div>
        </div>
        <form action={addPerson} className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-name">Full name</Label>
            <Input id="add-name" name="full_name" maxLength={120} autoComplete="off" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-phone">Mobile number (used to sign in)</Label>
            <Input
              id="add-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={30}
              autoComplete="off"
              placeholder="0917 123 4567"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-email">Email (optional)</Label>
            <Input id="add-email" name="email" type="email" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-password">Starting password</Label>
            <Input
              id="add-password"
              name="password"
              type="text"
              minLength={8}
              autoComplete="off"
              placeholder="At least 8 characters"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-role">Role</Label>
            <select
              id="add-role"
              name="role"
              defaultValue="operator"
              className="min-h-12 rounded-xl border border-field bg-card px-3 text-sm font-semibold text-ink"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-ink">
            <input type="checkbox" name="is_member" className="size-5 accent-[var(--brand)]" />
            Co-op member
          </label>
          <SubmitButton size="lg" className="md:col-span-2 md:justify-self-start">
            <UserPlus className="size-5" aria-hidden />
            Create account
          </SubmitButton>
        </form>
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        <Link
          href="/people"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-bold",
            !filter ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-muted-foreground",
          )}
        >
          Everyone ({everyone.length})
        </Link>
        {ROLES.map((r) => (
          <Link
            key={r}
            href={`/people?role=${r}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold",
              filter === r ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-muted-foreground",
            )}
          >
            {ROLE_LABELS[r]} ({count(r)})
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-card p-2 shadow-card md:p-3">
        {people.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted-foreground">Nobody with this role yet.</p>
        )}
        <ul>
          {people.map((p) => (
            <li key={p.id} className="border-b border-line/70 last:border-0">
              <form
                action={updatePerson}
                className="grid items-center gap-3 rounded-xl px-3 py-4 md:grid-cols-[1.6fr_1fr_auto_auto]"
              >
                <input type="hidden" name="id" value={p.id} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">{p.full_name || "(no name)"}</span>
                    {p.id === user.id && <Badge tone="gray">You</Badge>}
                    {p.is_member && (
                      <Badge tone="green">
                        <BadgeCheck className="mr-1 size-3.5" aria-hidden />
                        Member
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.phone ? formatPhMobile(p.phone) : "No phone"}
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="sr-only">Role for {p.full_name}</span>
                  <select
                    name="role"
                    defaultValue={p.role}
                    disabled={p.id === user.id}
                    className="min-h-12 rounded-xl border border-field bg-card px-3 text-sm font-semibold text-ink"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  {p.id === user.id && <input type="hidden" name="role" value={p.role} />}
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    name="is_member"
                    defaultChecked={p.is_member}
                    className="size-5 accent-[var(--brand)]"
                  />
                  Member
                </label>
                <SubmitButton variant="outline">
                  Save
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
