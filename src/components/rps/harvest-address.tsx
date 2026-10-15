import { MapPin } from "lucide-react";

/**
 * Where to harvest, with a link that opens the address in Google Maps.
 * (Just a normal link: no map service, key or tracking in the app.)
 */
export function HarvestAddress({ address }: { address: string | null | undefined }) {
  if (!address) return null;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-gold-soft p-3 text-sm">
      <MapPin className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gold-dark">
          Where to harvest
        </div>
        <div className="break-words font-semibold text-ink">{address}</div>
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs font-bold text-brand"
        >
          Open in Maps ↗
        </a>
      </div>
    </div>
  );
}
