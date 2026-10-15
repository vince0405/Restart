import { getPriceHistory, getSession } from "@/lib/session";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
}

/**
 * The farmgate reference prices, newest first, folded away (Ticket 28).
 * Shows nothing if the reader cannot see the history (RLS) or 013 has not
 * been run.
 */
export async function PriceHistory({ className }: { className?: string }) {
  const prices = await getPriceHistory();
  if (prices.length === 0) return null;

  // Names for "set by".
  const { supabase } = await getSession();
  const who = [...new Set(prices.map((p) => p.set_by).filter((v): v is string => !!v))];
  const { data: people } = who.length
    ? await supabase.from("profiles").select("id, full_name").in("id", who)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, (p.full_name as string) || "Unnamed"]));

  return (
    <details className={`rounded-xl border border-line p-3 text-sm ${className ?? ""}`}>
      <summary className="cursor-pointer font-bold text-ink">
        Reference price history ({prices.length})
      </summary>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {prices.map((p, i) => (
          <li key={`${p.set_at}-${i}`} className="flex flex-wrap justify-between gap-x-3 py-2">
            <span className="font-bold text-ink">
              {peso.format(p.price_per_kg)}
              {i === 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">(now)</span>}
            </span>
            <span className="text-muted-foreground">
              from {formatDate(p.set_at)}
              {p.set_by ? ` · ${names.get(p.set_by) ?? "Unknown"}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
