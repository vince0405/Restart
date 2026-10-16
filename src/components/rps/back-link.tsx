import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * "Back" at the top of the sign-in and sign-up pages. A plain link to a
 * fixed page, not the browser's history, so it works even when the page was
 * opened from a shared link.
 */
export function BackLink({ href = "/", children = "Back to home" }: { href?: string; children?: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 flex min-h-11 items-center gap-1 self-start rounded-lg px-2 text-sm font-bold text-brand hover:text-ink"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
