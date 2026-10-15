import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-12 w-full rounded-xl border border-input bg-card px-3 py-2 text-base text-ink md:text-sm",
        // A field the server marked wrong (aria-invalid) gets a red edge.
        "aria-[invalid=true]:border-2 aria-[invalid=true]:border-danger",
        "placeholder:text-muted-foreground",
        "focus-visible:border-brand",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
