import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** "Nothing here yet": an icon, a short title, one helpful line, and an action. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card px-6 py-12 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="size-7" aria-hidden />
      </span>
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}
