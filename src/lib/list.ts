// Shared helpers for lists with search, filters and pages (Jobs, History,
// People). Kept free of Next.js and Supabase so they can be unit-tested.

/** A whole page number from the address bar (?page=), 1 if missing or odd. */
export function parsePage(raw: unknown): number {
  const n = Number(typeof raw === "string" ? raw : "1");
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
}

/** Search text from the address bar (?q=): trimmed, at most 100 characters. */
export function parseSearch(raw: unknown): string {
  return (typeof raw === "string" ? raw : "").trim().slice(0, 100);
}

/** One of the allowed values, or the first one (the default). */
export function parseChoice<T extends string>(raw: unknown, allowed: readonly T[]): T {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : allowed[0];
}

/**
 * Search text made safe for a database "contains" match (ILIKE): % and _
 * would otherwise act as wildcards, and \ as an escape.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Rows from..to (inclusive, from 0) for this page — what .range() takes. */
export function pageRange(page: number, perPage: number): [number, number] {
  const from = (page - 1) * perPage;
  return [from, from + perPage - 1];
}

/** "Showing 11–20 of 25", the page count, and the page clamped to the end. */
export function pageInfo(page: number, perPage: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    first: total ? (current - 1) * perPage + 1 : 0,
    last: Math.min(current * perPage, total),
  };
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

/**
 * A list's address with these settings. Empty values, page 1 and each
 * setting's default are left out, so addresses stay short.
 */
export function listHref(
  base: string,
  params: Record<string, string | number | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === defaults[key]) continue;
    if (key === "page" && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
