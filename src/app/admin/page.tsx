import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/rps/badge";
import { EmptyState } from "@/components/rps/empty-state";
import { Logo } from "@/components/rps/logo";
import { Notice } from "@/components/rps/notice";
import { PageTitle } from "@/components/rps/page-title";
import { Panel, PanelHead } from "@/components/rps/panel";
import { StatCard } from "@/components/rps/stat-card";
import { ThemeButton } from "@/components/rps/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  coopListHref,
  type CoopFilter,
  type CoopRow,
  COOPS_PER_PAGE,
  pageNumbers,
  parseCoopQuery,
  searchCoops,
} from "@/lib/admin";
import { PASSWORD_RULE } from "@/lib/password";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { signOut } from "../actions";
import { addChairperson, addCooperative } from "./actions";

const MESSAGES: Record<string, string> = {
  coop_name: "Enter the cooperative's name (up to 120 characters).",
  name_missing: "Enter the Chairperson's full name.",
  phone_invalid: "Enter a Philippine mobile number, like 0917 123 4567.",
  phone_taken: "That mobile number already has an account.",
  email_invalid: "That email address doesn't look right.",
  password_short: `That starting password is too easy to guess. ${PASSWORD_RULE} Not a well-known one like password1, and not the mobile number.`,
  role_failed: "The account was made, but could not be made Chairperson.",
  flag_failed: "The Chairperson was added, but won't be asked to change the starting password. Ask them to change it under Account.",
  save_failed: "Could not save. Please try again.",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

/** The list's address plus ?coop= (opens "Add a Chairperson" for that co-op). */
function withCoop(href: string, coopId: string) {
  return `${href}${href.includes("?") ? "&" : "?"}coop=${encodeURIComponent(coopId)}#add-chair`;
}

/** Name, mobile, optional email and starting password of a Chairperson. */
function ChairFields({ prefix }: { prefix: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_name`}>Full name</Label>
        <Input id={`${prefix}_name`} name="full_name" maxLength={120} autoComplete="off" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_phone`}>Mobile number</Label>
        <Input
          id={`${prefix}_phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="0917 123 4567"
          autoComplete="off"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_email`}>
          Email <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id={`${prefix}_email`} name="email" type="email" autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}_password`}>Starting password</Label>
        <Input
          id={`${prefix}_password`}
          name="password"
          type="text"
          minLength={8}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <p className="text-xs text-muted-foreground">{PASSWORD_RULE} Share it privately.</p>
      </div>
    </div>
  );
}

/** One page button, or the current page (not a link). */
function PageLink({ href, current, children, label }: { href: string; current?: boolean; children: ReactNode; label?: string }) {
  return current ? (
    <span
      aria-current="page"
      className="grid size-11 place-items-center rounded-xl bg-brand text-sm font-bold text-on-brand"
    >
      {children}
    </span>
  ) : (
    <Link
      href={href}
      aria-label={label}
      className="grid size-11 place-items-center rounded-xl border border-line bg-card text-sm font-semibold text-ink transition-colors hover:border-brand"
    >
      {children}
    </Link>
  );
}

// The main Admin (Ticket 34): every co-op using RPS1, and adding a new one
// with its first Chairperson. No jobs, money or people lists here — the
// database does not show them to the Admin.
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { supabase, isAdmin, profile } = await getSession();
  if (!isAdmin) redirect("/");

  const { error, added, coop: chairFor, ...rawQuery } = await searchParams;
  const { data, error: listError } = await supabase.rpc("admin_list_cooperatives");
  const coops = (data ?? []) as CoopRow[];

  // Search, filter and pages all live in the address (?q=&show=&page=), so
  // Back and shared links keep them.
  const query = parseCoopQuery(rawQuery);
  const result = searchCoops(coops, query);
  const listHref = coopListHref({ ...query, page: result.page });
  const filtering = query.q !== "" || query.show !== "all";
  const first = result.total ? (result.page - 1) * COOPS_PER_PAGE + 1 : 0;
  const last = Math.min(result.page * COOPS_PER_PAGE, result.total);

  const stats = {
    coops: coops.length,
    noChair: coops.filter((c) => !c.chairpersons).length,
    people: coops.reduce((n, c) => n + Number(c.people), 0),
    towns: new Set(coops.map((c) => c.town.trim().toLowerCase()).filter(Boolean)).size,
  };
  const filters: { value: CoopFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.coops },
    { value: "no-chair", label: "Needs a Chairperson", count: stats.noChair },
  ];
  const chairCoop = typeof chairFor === "string" ? coops.find((c) => c.id === chairFor) : undefined;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <Logo />
          <span className="hidden items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand sm:inline-flex">
            <ShieldCheck className="size-3.5" aria-hidden />
            Admin console
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm font-semibold text-muted-foreground md:inline">
              {profile.full_name || "Admin"}
            </span>
            <ThemeButton />
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="grid size-11 place-items-center rounded-xl border border-line bg-card text-muted-foreground transition-colors hover:text-danger"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-8 md:pt-8">
        <PageTitle
          eyebrow="Main admin"
          title="Cooperatives"
          description="Every co-op using RPS1. Each one sees only its own people, transactions and money — you add co-ops and their first Chairperson."
          action={
            <a href="#add-coop" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
              <Plus className="size-5" aria-hidden />
              Add cooperative
            </a>
          }
        />

        {added && (
          <Notice tone="success" title="Saved">
            Give the Chairperson their mobile number and starting password, and ask them to change
            the password under Account.
          </Notice>
        )}
        {typeof error === "string" && <Notice tone="error">{MESSAGES[error] ?? MESSAGES.save_failed}</Notice>}
        {listError && <Notice tone="error">Could not load the co-ops. Please refresh.</Notice>}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Cooperatives" value={String(stats.coops)} icon={Building2} />
          <StatCard
            label="Need a Chairperson"
            value={String(stats.noChair)}
            icon={UserPlus}
            tone="amber"
            attention={stats.noChair > 0}
            href={stats.noChair > 0 ? coopListHref({ q: "", show: "no-chair", page: 1 }) : undefined}
          />
          <StatCard label="People with accounts" value={String(stats.people)} icon={Users} tone="blue" />
          <StatCard label="Towns" value={String(stats.towns)} icon={MapPin} tone="blue" />
        </div>

        {chairCoop && (
          <Panel highlight className="mb-6 scroll-mt-24" labelledBy="add-chair-title">
            <div id="add-chair" className="flex items-start justify-between gap-3">
              <PanelHead icon={UserPlus} tone="bg-gold-soft text-gold-dark" title={`Add a Chairperson to ${chairCoop.name}`} id="add-chair-title" />
              <Link href={listHref} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-surface hover:text-ink">
                <X className="size-5" aria-hidden />
              </Link>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              A new account is made for them in this co-op. They sign in with this mobile number.
            </p>
            <form action={addChairperson} className="mt-5 flex flex-col gap-4">
              <input type="hidden" name="coop_id" value={chairCoop.id} />
              <ChairFields prefix="chair" />
              <div className="flex flex-col gap-3 sm:flex-row">
                <SubmitButton size="lg">Add Chairperson</SubmitButton>
                <Link href={listHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Cancel
                </Link>
              </div>
            </form>
          </Panel>
        )}

        <section aria-labelledby="list-title" className="rounded-2xl border border-line bg-card shadow-card">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-center">
            <h2 id="list-title" className="sr-only">
              Co-op list
            </h2>
            <form action="/admin" method="get" role="search" className="flex flex-1 gap-2">
              {query.show !== "all" && <input type="hidden" name="show" value={query.show} />}
              <label htmlFor="q" className="sr-only">
                Search co-ops by name or town
              </label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={query.q}
                  placeholder="Search by name or town"
                  maxLength={100}
                  className="pl-9"
                />
              </div>
              <SubmitButton variant="secondary">Search</SubmitButton>
            </form>
            <nav aria-label="Filter" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
              {filters.map((f) => {
                const on = query.show === f.value;
                return (
                  <Link
                    key={f.value}
                    href={coopListHref({ q: query.q, show: f.value, page: 1 })}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm",
                      on ? "bg-card font-bold text-ink shadow-card" : "font-semibold text-muted-foreground hover:text-ink",
                    )}
                  >
                    {f.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular-nums",
                        on ? "bg-brand text-on-brand" : "bg-line text-muted-foreground",
                      )}
                    >
                      {f.count}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {result.total === 0 ? (
            <div className="p-4 sm:p-5">
              {filtering ? (
                <EmptyState
                  icon={Search}
                  title="No co-ops match"
                  action={
                    <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
                      Clear search
                    </Link>
                  }
                >
                  Nothing matches {query.q ? <>&ldquo;{query.q}&rdquo;</> : "this filter"}. Try another name or town.
                </EmptyState>
              ) : (
                <EmptyState
                  icon={Building2}
                  title="No cooperatives yet"
                  action={
                    <a href="#add-coop" className={buttonVariants()}>
                      Add the first one
                    </a>
                  }
                >
                  Add a co-op and its first Chairperson to get them started.
                </EmptyState>
              )}
            </div>
          ) : (
            <>
              {/* Phones: one card per co-op. */}
              <ul className="divide-y divide-line md:hidden">
                {result.rows.map((c) => (
                  <li key={c.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                        <Building2 className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-ink">{c.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {c.town || "No town"} · {Number(c.people)} {Number(c.people) === 1 ? "person" : "people"}
                        </div>
                        <div className="mt-2">
                          {c.chairpersons ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                              <UserRound className="size-4 text-muted-foreground" aria-hidden />
                              {c.chairpersons}
                            </span>
                          ) : (
                            <Badge tone="amber">Needs a Chairperson</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={withCoop(listHref, c.id)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}>
                      <UserPlus className="size-4" aria-hidden />
                      Add Chairperson
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Tablets and computers: a table. */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-5 py-3 font-bold">Cooperative</th>
                      <th scope="col" className="px-3 py-3 font-bold">Chairperson</th>
                      <th scope="col" className="px-3 py-3 text-right font-bold">People</th>
                      <th scope="col" className="px-3 py-3 font-bold">Added</th>
                      <th scope="col" className="px-5 py-3 text-right font-bold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((c) => (
                      <tr key={c.id} className="border-b border-line/70 last:border-0 hover:bg-surface/60">
                        <th scope="row" className="px-5 py-3 text-left font-normal">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                              <Building2 className="size-4" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-bold text-ink">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.town || "No town"}</div>
                            </div>
                          </div>
                        </th>
                        <td className="px-3 py-3">
                          {c.chairpersons ? (
                            <span className="text-ink">{c.chairpersons}</span>
                          ) : (
                            <Badge tone="amber">Needs a Chairperson</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink">{Number(c.people)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={withCoop(listHref, c.id)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-bold text-brand hover:bg-brand-soft"
                          >
                            <UserPlus className="size-4" aria-hidden />
                            Add Chairperson
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 border-t border-line p-4 sm:flex-row sm:px-5">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Showing <strong className="text-ink">{first}–{last}</strong> of{" "}
                  <strong className="text-ink">{result.total}</strong>
                  {query.q ? <> matching &ldquo;{query.q}&rdquo;</> : null}
                  {filtering && (
                    <>
                      {" · "}
                      <Link href="/admin" className="font-bold text-brand">
                        Clear
                      </Link>
                    </>
                  )}
                </p>
                {result.pages > 1 && (
                  <nav aria-label="Pages" className="flex items-center gap-1.5">
                    {result.page > 1 ? (
                      <PageLink href={coopListHref({ ...query, page: result.page - 1 })} label="Previous page">
                        <ChevronLeft className="size-4" aria-hidden />
                      </PageLink>
                    ) : (
                      <span aria-hidden className="grid size-11 place-items-center rounded-xl border border-line text-muted-foreground opacity-40">
                        <ChevronLeft className="size-4" />
                      </span>
                    )}
                    {pageNumbers(result.page, result.pages).map((n, i) =>
                      n === "gap" ? (
                        <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
                          …
                        </span>
                      ) : (
                        <PageLink
                          key={n}
                          href={coopListHref({ ...query, page: n })}
                          current={n === result.page}
                          label={`Page ${n}`}
                        >
                          {n}
                        </PageLink>
                      ),
                    )}
                    {result.page < result.pages ? (
                      <PageLink href={coopListHref({ ...query, page: result.page + 1 })} label="Next page">
                        <ChevronRight className="size-4" aria-hidden />
                      </PageLink>
                    ) : (
                      <span aria-hidden className="grid size-11 place-items-center rounded-xl border border-line text-muted-foreground opacity-40">
                        <ChevronRight className="size-4" />
                      </span>
                    )}
                  </nav>
                )}
              </div>
            </>
          )}
        </section>

        <section id="add-coop" aria-labelledby="add-coop-title" className="mt-8 scroll-mt-24">
          <form action={addCooperative} className="rounded-2xl border border-line bg-card shadow-card">
            <div className="border-b border-line p-5 md:p-6">
              <h2 id="add-coop-title" className="text-lg font-extrabold text-ink">
                Add a cooperative
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                It starts with the standard price list; its Chairperson can change the rates in
                Settings.
              </p>
            </div>
            <div className="grid gap-8 p-5 md:p-6 lg:grid-cols-[14rem_1fr]">
              <div>
                <h3 className="font-bold text-ink">Cooperative</h3>
                <p className="mt-1 text-xs text-muted-foreground">Shown to customers when they sign up.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="coop_name">Name</Label>
                  <Input id="coop_name" name="coop_name" maxLength={120} placeholder="e.g. San Jose Farmers MPC" required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="town">Town</Label>
                  <Input id="town" name="town" maxLength={120} placeholder="e.g. San Jose" />
                </div>
              </div>

              <div className="border-t border-line pt-6 lg:col-span-2 lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8">
                <div className="mb-4 lg:mb-0">
                  <h3 className="font-bold text-ink">First Chairperson</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Runs the co-op in RPS1 and adds its staff. Signs in with this mobile number.
                  </p>
                </div>
                <ChairFields prefix="new" />
              </div>
            </div>
            <div className="flex justify-end border-t border-line bg-surface/60 p-4 md:px-6">
              <SubmitButton size="lg" className="w-full sm:w-auto">
                <Plus className="size-5" aria-hidden />
                Add cooperative
              </SubmitButton>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
