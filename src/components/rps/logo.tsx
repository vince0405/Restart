import { Leaf } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-brand text-white shadow-logo">
        <Leaf className="size-[23px]" aria-hidden />
      </div>
      {!compact && (
        <div>
          <div className="text-xl font-extrabold tracking-tight text-ink">
            RPS<span className="text-gold">1</span>
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Rice Processing
          </div>
        </div>
      )}
    </div>
  );
}
