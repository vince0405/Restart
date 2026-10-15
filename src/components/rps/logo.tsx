import Image from "next/image";

/**
 * The RPS1 logo (rice stalk, mill and gear), with the name beside it. The
 * mark sits on a small white tile so its dark gear stays visible in dark
 * mode. The image is a 256px copy in public/logo.png (the original is
 * 2.4 MB — too heavy for every page).
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-0.5 shadow-card ring-1 ring-line">
        <Image src="/logo.png" alt={compact ? "RPS1" : ""} width={40} height={40} priority className="size-10" />
      </span>
      {!compact && (
        <div>
          <div className="text-xl font-extrabold tracking-tight text-ink">
            RPS<span className="text-gold">1</span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Rice Processing
          </div>
        </div>
      )}
    </div>
  );
}
