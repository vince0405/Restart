// Supabase hands back at most 1,000 rows per request. Pages that add up
// totals (Statistics, the dashboard) must see every job, so this asks for
// them 1,000 at a time until the last, shorter, page (Ticket 42).

type Page<T> = PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;

/** Every row, by asking for rows from..to until a page comes back short. */
export async function fetchAll<T>(
  page: (from: number, to: number) => Page<T>,
  size = 1000,
  maxPages = 100,
): Promise<{ data: T[]; error: { message?: string } | null }> {
  const rows: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const from = i * size;
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return { data: rows, error: null };
}
