import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Logo } from "@/components/rps/logo";
import { Notice } from "@/components/rps/notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { coopListHref, type CoopFilter, type CoopRow, parseCoopQuery, searchCoops } from "@/lib/admin";
import { cn } from "@/lib/utils";
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

  const { error, added, ...rawQuery } = await searchParams;
  const { data, error: listError } = await supabase.rpc("admin_list_cooperatives");
  const coops = (data ?? []) as CoopRow[];

  // Search, filter and pages all live in the address (?q=&show=&page=), so
  // Back and shared links keep them.
  const query = parseCoopQuery(rawQuery);
  const result = searchCoops(coops, query);
  const filters: { value: CoopFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "no-chair", label: "Needs a Chairperson" },
  ];

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

      <form action="/admin" method="get" role="search" className="mb-3 flex gap-2">
        {query.show !== "all" && <input type="hidden" name="show" value={query.show} />}
        <label htmlFor="q" className="sr-only">
          Search co-ops by name or town
        </label>
        <Input id="q" name="q" type="search" defaultValue={query.q} placeholder="Search by name or town" maxLength={100} />
        <SubmitButton variant="outline" aria-label="Search">
          <Search className="size-4" aria-hidden />
          <span className="hidden sm:inline">Search</span>
        </SubmitButton>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter" className="flex gap-1 rounded-xl border border-line bg-card p-1">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={coopListHref({ q: query.q, show: f.value, page: 1 })}
              aria-current={query.show === f.value ? "page" : undefined}
              className={
                query.show === f.value
                  ? "flex min-h-11 items-center rounded-lg bg-brand px-3 text-sm font-bold text-on-brand"
                  : "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:text-ink"
              }
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {result.total} {result.total === 1 ? "co-op" : "co-ops"}
          {query.q ? ` matching “${query.q}”` : ""}
          {(query.q || query.show !== "all") && (
            <>
              {" · "}
              <Link href="/admin" className="font-bold text-brand">
                Clear
              </Link>
            </>
          )}
        </p>
      </div>

      {result.total === 0 && !listError && (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-muted-foreground">
          No co-ops match. Try another name or town.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {result.rows.map((c) => (
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

      {result.pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
          {result.page > 1 ? (
            <Link href={coopListHref({ ...query, page: result.page - 1 })} className={buttonVariants({ variant: "outline" })}>
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50")} aria-disabled="true">
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </span>
          )}
          <span className="text-sm font-semibold text-muted-foreground">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link href={coopListHref({ ...query, page: result.page + 1 })} className={buttonVariants({ variant: "outline" })}>
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50")} aria-disabled="true">
              Next
              <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </nav>
      )}

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
