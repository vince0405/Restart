// Short money and number formats for charts and quick lists (Ticket 37):
//   950 -> 950, 1000 -> 1k, 1500 -> 1.5k, 10000 -> 10k, 1000000 -> 1m
// The exact amount stays available (title, tooltip or table) wherever a
// short one is shown, so nothing is hidden from the Auditor.

function trim(n: number): string {
  // One decimal at most, and no ".0".
  return (Math.round(n * 10) / 10).toString();
}

export function formatShort(value: number): string {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a < 1000) return sign + trim(a);
  // Round first, so 999,950 shows as 1m, not 1000k.
  if (Math.round(a / 100) < 10_000) return `${sign}${trim(a / 1000)}k`;
  if (Math.round(a / 100_000) < 10_000) return `${sign}${trim(a / 1_000_000)}m`;
  return `${sign}${trim(a / 1_000_000_000)}b`;
}

/** "₱1.5k" */
export function pesoShort(value: number): string {
  const s = formatShort(value);
  return s.startsWith("-") ? `-₱${s.slice(1)}` : `₱${s}`;
}
