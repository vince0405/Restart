import Link from "next/link";
import { Notice } from "@/components/rps/notice";
import { BadgeCheck, Search, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/rps/empty-state";
import { FilterTabs, Pagination, SearchBox } from "@/components/rps/list-controls";
import { buttonVariants } from "@/components/ui/button";
import { listHref, pageInfo, parsePage, parseSearch } from "@/lib/list";
import { matchesPerson } from "@/lib/people";
import { Badge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/components/rps/error-note";
import { canManagePeople, isRole, ROLE_LABELS, ROLES } from "@/lib/roles";
import { formatPhMobile } from "@/lib/phone";
import { requireRole } from "@/lib/session";
import { addPerson, updatePerson } from "./actions";

type Person = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  role: keyof typeof ROLE_LABELS;
  is_member: boolean;
  pay_later: boolean;
};

const PER_PAGE = 15;

// Chairperson only: add people, and set everyone's role and member flag.
export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const { supabase, user } = await requireRole(canManagePeople);
  const { error, saved, added, role: roleFilter, q: rawQ, page: rawPage } = await searchParams;
  const filter = isRole(roleFilter) ? roleFilter : null;
  const q = parseSearch(rawQ);

  const { data } = await supabase
    .from("profiles")
    .select("id, created_at, full_name, phone, role, is_member, pay_later")
    .order("created_at", { ascending: false });
  const everyone = (data ?? []) as Person[];
  // RLS only returns the Chairperson's own co-op, so the list stays small:
  // search, filter and pages are worked out here.
  const searched = everyone.filter((p) => matchesPerson(p, q));
  const matching = filter ? searched.filter((p) => p.role === filter) : searched;
  const count = (r: string) => searched.filter((p) => p.role === r).length;
  const info = pageInfo(parsePage(rawPage), PER_PAGE, matching.length);
  const people = matching.slice((info.page - 1) * PER_PAGE, info.page * PER_PAGE);
  const href = (changes: Record<string, string | number>) =>
    listHref("/people", { q, role: filter ?? "", page: info.page, ...changes });
  // Keep the add form open after a problem adding someone.
  const addProblem = typeof error === "string" && !saved;

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

      <details open={addProblem} className="group/add mb-6 rounded-2xl border border-line bg-card shadow-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <UserPlus className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold text-ink">Add a person</h2>
            <p className="text-xs text-muted-foreground">
              Creates their account with the role you choose. They can sign in straight away.
            </p>
          </div>
          <span className="text-sm font-bold text-brand">
            <span className="group-open/add:hidden">Open</span>
            <span className="hidden group-open/add:inline">Close</span>
          </span>
        </summary>
        <form action={addPerson} className="grid gap-4 border-t border-line p-4 md:grid-cols-2 md:p-5">
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
      </details>

      <section className="rounded-2xl border border-line bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
          <SearchBox
            action="/people"
            q={q}
            placeholder="Search by name or mobile number"
            label="Search people by name or mobile number"
            keep={filter ? { role: filter } : {}}
          />
          <FilterTabs
            label="Role"
            tabs={[
              { label: "Everyone", href: href({ role: "", page: 1 }), active: !filter, count: searched.length },
              ...ROLES.map((r) => ({
                label: ROLE_LABELS[r],
                href: href({ role: r, page: 1 }),
                active: filter === r,
                count: count(r),
              })),
            ]}
          />
        </div>
        {people.length === 0 && (
          <div className="p-4 sm:p-5">
            {q || filter ? (
              <EmptyState
                icon={Search}
                title="Nobody matches"
                action={
                  <Link href="/people" className={buttonVariants({ variant: "outline" })}>
                    Clear search
                  </Link>
                }
              >
                Try another name, number or role.
              </EmptyState>
            ) : (
              <EmptyState icon={Users} title="Nobody here yet">
                Add your staff and members above.
              </EmptyState>
            )}
          </div>
        )}
        <ul className="p-2 md:p-3">
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
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      name="is_member"
                      defaultChecked={p.is_member}
                      className="size-5 accent-[var(--brand)]"
                    />
                    Member
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      name="pay_later"
                      defaultChecked={p.pay_later}
                      className="size-5 accent-[var(--brand)]"
                    />
                    Pay later
                  </label>
                </div>
                <SubmitButton variant="outline">
                  Save
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
        {matching.length > 0 && (
          <Pagination {...info} total={matching.length} noun={["person", "people"]} hrefFor={(page) => href({ page })} />
        )}
      </section>
    </div>
  );
}
