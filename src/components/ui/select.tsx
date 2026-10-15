import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex min-h-12 w-full rounded-xl border border-input bg-card px-3 py-2 text-base text-ink md:text-sm",
        // A field the server marked wrong (aria-invalid) gets a red edge.
        "aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger",
        "focus-visible:border-brand",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
