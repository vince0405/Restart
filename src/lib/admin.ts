// The Admin's co-op list (Ticket 34): search, filter and pages. Kept free
// of Next.js and Supabase so it can be unit-tested directly.

export type CoopRow = {
  id: string;
  name: string;
  town: string;
  created_at: string;
  /** Chairperson names, comma-separated; "" if none yet. */
  chairpersons: string;
  people: number;
};

export type CoopFilter = "all" | "no-chair";

export const COOPS_PER_PAGE = 10;

/** Reads ?q=, ?show= and ?page= from the address bar, safely. */
export function parseCoopQuery(raw: { q?: unknown; show?: unknown; page?: unknown }) {
  const q = (typeof raw.q === "string" ? raw.q : "").trim().slice(0, 100);
  const show: CoopFilter = raw.show === "no-chair" ? "no-chair" : "all";
  const n = Number(typeof raw.page === "string" ? raw.page : "1");
  const page = Number.isInteger(n) && n >= 1 ? n : 1;
  return { q, show, page };
}

/**
 * The co-ops matching the search (name or town, any case) and filter, cut
 * to one page. A page past the end shows the last page.
 */
export function searchCoops(
  coops: CoopRow[],
  { q, show, page }: { q: string; show: CoopFilter; page: number },
  perPage: number = COOPS_PER_PAGE,
) {
  const needle = q.toLowerCase();
  const matches = coops.filter(
    (c) =>
      (!needle || c.name.toLowerCase().includes(needle) || c.town.toLowerCase().includes(needle)) &&
      (show === "all" || !c.chairpersons),
  );
  const pages = Math.max(1, Math.ceil(matches.length / perPage));
  const current = Math.min(page, pages);
  return {
    rows: matches.slice((current - 1) * perPage, current * perPage),
    total: matches.length,
    page: current,
    pages,
  };
}

/** The address of the list with these settings (page 1 and "all" left out). */
export function coopListHref({ q, show, page }: { q: string; show: CoopFilter; page: number }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (show !== "all") params.set("show", show);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

/**
 * The page buttons to show: always the first and last page, the pages next
 * to the current one, and "gap" where pages are skipped.
 * 10 pages, on page 5: [1, "gap", 4, 5, 6, "gap", 10].
 */
export function pageNumbers(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(n - sorted[i - 1] === 2 ? n - 1 : "gap");
    out.push(n);
  });
  return out;
}
