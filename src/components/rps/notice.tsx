import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info" | "warning";

const STYLES: Record<Tone, { box: string; icon: typeof Info; iconColour: string }> = {
  error: { box: "border-danger bg-danger-soft", icon: CircleAlert, iconColour: "text-danger" },
  success: { box: "border-brand bg-brand-soft", icon: CircleCheck, iconColour: "text-brand" },
  info: { box: "border-info bg-info-soft", icon: Info, iconColour: "text-info-dark" },
  warning: { box: "border-gold bg-gold-soft", icon: TriangleAlert, iconColour: "text-gold-dark" },
};

/**
 * A message banner. Always an icon AND words (never colour alone).
 * Errors are announced at once by screen readers (role="alert"); other
 * messages politely (role="status").
 */
export function Notice({
  tone,
  title,
  children,
  className,
  id,
}: {
  id?: string;
  tone: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon, iconColour } = STYLES[tone];
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn("mb-4 flex items-start gap-3 rounded-xl border-l-4 p-3 text-sm text-ink", box, className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColour)} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}
