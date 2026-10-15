import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** "Process › #RPS-AF8D1": where you are, and one tap back up. */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-brand underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="px-1 font-semibold text-ink">
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
