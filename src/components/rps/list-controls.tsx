import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { pageNumbers } from "@/lib/list";
import { cn } from "@/lib/utils";

// The search box, filter tabs and page buttons shared by Jobs, History and
// People, so every list looks and works the same. Everything lives in the
// address (?q=&page=…), so Back and shared links keep the view.

/** A search box that sends ?q= (plus any filters to keep) to `action`. */
export function SearchBox({
  action,
  q,
  placeholder,
  keep = {},
  label,
  children,
}: {
  action: string;
  q: string;
  placeholder: string;
  /** Filters to keep when searching, e.g. { status: "ready" }. */
  keep?: Record<string, string>;
  label: string;
  /** Extra filters (e.g. a FilterSelect), sent with the search. */
  children?: ReactNode;
}) {
  return (
    <form action={action} method="get" role="search" className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="list-search" className="sr-only">
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="list-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={placeholder}
          maxLength={100}
          className="pl-9"
        />
      </div>
      {children}
      <SubmitButton variant="secondary">Search</SubmitButton>
    </form>
  );
}

export type FilterTab = { label: string; href: string; active: boolean; count?: number };

/** A row of filter tabs (links). The active one is marked for screen readers. */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {tabs.map((t) => (
        <Link
          key={t.href + t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
            t.active ? "bg-card font-bold text-ink shadow-card" : "font-semibold text-muted-foreground hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                t.active ? "bg-brand text-on-brand" : "bg-line text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** A labelled dropdown of filter options that applies on "Apply" (no script). */
export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-muted-foreground">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="min-h-11 rounded-xl border border-field bg-card px-3 text-sm font-semibold text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PageButton({
  href,
  current,
  label,
  children,
}: {
  href: string;
  current?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return current ? (
    <span aria-current="page" className="grid size-11 place-items-center rounded-xl bg-brand text-sm font-bold text-on-brand">
      {children}
    </span>
  ) : (
    <Link
      href={href}
      aria-label={label}
      className="press grid size-11 place-items-center rounded-xl border border-line bg-card text-sm font-semibold text-ink transition-colors hover:border-brand"
    >
      {children}
    </Link>
  );
}

function Disabled({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="grid size-11 place-items-center rounded-xl border border-line text-muted-foreground opacity-40">
      {children}
    </span>
  );
}

/** "Showing 11–20 of 25" and numbered page buttons. */
export function Pagination({
  page,
  pages,
  first,
  last,
  total,
  noun,
  hrefFor,
}: {
  page: number;
  pages: number;
  first: number;
  last: number;
  total: number;
  /** What is listed, e.g. ["job", "jobs"]. */
  noun: [string, string];
  hrefFor: (page: number) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line p-4 sm:flex-row sm:px-5">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? (
          <>No {noun[1]}</>
        ) : (
          <>
            Showing <strong className="text-ink">{first}–{last}</strong> of{" "}
            <strong className="text-ink">{total}</strong> {total === 1 ? noun[0] : noun[1]}
          </>
        )}
      </p>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-1.5">
          {page > 1 ? (
            <PageButton href={hrefFor(page - 1)} label="Previous page">
              <ChevronLeft className="size-4" aria-hidden />
            </PageButton>
          ) : (
            <Disabled>
              <ChevronLeft className="size-4" />
            </Disabled>
          )}
          {pageNumbers(page, pages).map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <PageButton key={n} href={hrefFor(n)} current={n === page} label={`Page ${n}`}>
                {n}
              </PageButton>
            ),
          )}
          {page < pages ? (
            <PageButton href={hrefFor(page + 1)} label="Next page">
              <ChevronRight className="size-4" aria-hidden />
            </PageButton>
          ) : (
            <Disabled>
              <ChevronRight className="size-4" />
            </Disabled>
          )}
        </nav>
      )}
    </div>
  );
}
