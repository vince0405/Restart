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
