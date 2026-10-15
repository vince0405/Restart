"use client";

// Money statistics charts, built from plain HTML so text stays readable on a
// 360px phone (an SVG that scales down would shrink its labels too).
//
// Follows the dataviz rules: bars <= 24px with a 4px rounded top, a 2px gap
// between stacked parts, hairline gridlines, a legend for the two series,
// one direct label (this month), a tooltip on hover AND keyboard focus, and
// every number also available in a table.

import { useState } from "react";
import { cn } from "@/lib/utils";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

/** 0, then 3–4 round steps (1/2/5 × 10ⁿ) that cover the biggest value. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1000, 2000, 3000];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export type MonthPoint = { key: string; label: string; year: number; collected: number; owed: number; jobs: number };

/** Stacked columns: fees collected (bottom) and still owed (top), per month. */
export function FeesByMonthChart({ months }: { months: MonthPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...months.map((m) => m.collected + m.owed)));
  const top = ticks[ticks.length - 1];
  const pct = (v: number) => `${(v / top) * 100}%`;
  const last = months.length - 1;

  return (
    <figure>
      <figcaption className="sr-only">
        Fees per month: collected and still owed. The same numbers are in the table below the chart.
      </figcaption>

      {/* Legend: always shown for two series; text in ink, colour on the swatch. */}
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-ink" aria-hidden>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-chart-1" /> Collected
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-chart-2" /> Still owed
        </span>
      </div>

      <div className="relative flex h-56 gap-2 pl-12">
        {/* Y axis: round, comma'd ticks with hairline gridlines */}
        {ticks.map((t) => (
          <div
            key={t}
            className="pointer-events-none absolute inset-x-0 flex items-center"
            style={{ bottom: pct(t), transform: "translateY(50%)" }}
            aria-hidden
          >
            <span className="w-11 pr-2 text-right text-xs tabular-nums text-muted-foreground">
              {t === 0 ? "0" : compact.format(t)}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}

        {months.map((m, i) => {
          const total = m.collected + m.owed;
          const isActive = active === i;
          return (
            <button
              key={m.key}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${m.label} ${m.year}: collected ${peso.format(m.collected)}, still owed ${peso.format(m.owed)}, ${m.jobs} ${m.jobs === 1 ? "job" : "jobs"}`}
              // The whole column slot is the hit target, not just the thin bar.
              className="relative z-10 flex min-w-0 flex-1 cursor-default flex-col items-center justify-end rounded-lg focus-visible:outline-offset-0"
            >
              {/* Direct label on this month only — the rest live in the tooltip and table. */}
              {i === last && total > 0 && (
                <span className="mb-1 text-xs font-bold tabular-nums text-ink">{compact.format(total)}</span>
              )}
              <span
                className={cn("flex w-full max-w-6 flex-col justify-end transition-opacity", active !== null && !isActive && "opacity-50")}
                style={{ height: pct(total) }}
              >
                {m.owed > 0 && (
                  <span
                    className="block rounded-t bg-chart-2"
                    style={{ height: `${(m.owed / (total || 1)) * 100}%` }}
                  />
                )}
                {m.owed > 0 && m.collected > 0 && <span className="block h-0.5 shrink-0 bg-card" />}
                {m.collected > 0 && (
                  <span
                    className={cn("block bg-chart-1", m.owed === 0 && "rounded-t")}
                    style={{ height: `${(m.collected / (total || 1)) * 100}%` }}
                  />
                )}
              </span>
              {isActive && (
                <span
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute bottom-full z-20 mb-2 w-max min-w-40 rounded-xl border border-line bg-card p-3 text-left text-sm shadow-card",
                    // Open towards the middle so it never runs off the screen.
                    i < months.length / 2 ? "left-0" : "right-0",
                  )}
                >
                  <span className="block text-xs font-bold text-muted-foreground">
                    {m.label} {m.year} · {m.jobs} {m.jobs === 1 ? "job" : "jobs"}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-0.5 w-3 bg-chart-1" />
                    <strong className="tabular-nums text-ink">{peso.format(m.collected)}</strong>
                    <span className="text-muted-foreground">collected</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-0.5 w-3 bg-chart-2" />
                    <strong className="tabular-nums text-ink">{peso.format(m.owed)}</strong>
                    <span className="text-muted-foreground">still owed</span>
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* X axis: month names */}
      <div className="mt-2 flex gap-2 pl-12" aria-hidden>
        {months.map((m) => (
          <span key={m.key} className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground">
            {m.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** One series: horizontal bars, value at the tip. Name on its own line so
 *  the bar always has room, even on a 360px phone. */
export function JobsByServiceChart({ rows }: { rows: { service: string; jobs: number; fees: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.jobs));
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.service}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-ink">{r.service}</span>
            <span className="tabular-nums text-muted-foreground">{peso.format(r.fees)}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* The track takes the free width; the bar is a share of it. */}
            <div className="min-w-0 flex-1" aria-hidden>
              <div
                className="h-5 rounded-r bg-chart-1"
                style={{ width: `${(r.jobs / max) * 100}%`, minWidth: r.jobs ? "4px" : 0 }}
              />
            </div>
            <span className="w-16 shrink-0 text-sm tabular-nums text-ink">
              <strong>{r.jobs}</strong> {r.jobs === 1 ? "job" : "jobs"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
