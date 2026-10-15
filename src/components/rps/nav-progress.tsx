"use client";

// A thin green-and-gold bar across the top of the screen that starts the
// moment someone taps a link, searches or submits a form, and finishes when
// the next page arrives (Ticket 39). On a slow connection it shows at once
// that the tap worked, before the page's own loading screen appears.
//
// It moves the bar directly (no React state), so it never re-draws the
// page. A safety timer hides it if no new page comes (for example a form
// that only shows an error), so it can never get stuck.

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const SAFETY_MS = 10_000;

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const bar = useRef<HTMLDivElement>(null);
  const timers = useRef<{ trickle?: number; safety?: number; hide?: number }>({});
  const running = useRef(false);
  const width = useRef(0);

  const set = (w: number, visible: boolean) => {
    const el = bar.current;
    if (!el) return;
    width.current = w;
    el.style.transform = `scaleX(${w / 100})`;
    el.style.opacity = visible ? "1" : "0";
  };

  const clear = () => {
    window.clearInterval(timers.current.trickle);
    window.clearTimeout(timers.current.safety);
    window.clearTimeout(timers.current.hide);
  };

  const done = () => {
    if (!running.current) return;
    running.current = false;
    clear();
    set(100, true);
    timers.current.hide = window.setTimeout(() => set(0, false), 250);
  };

  const start = () => {
    clear();
    running.current = true;
    set(12, true);
    // Creep towards 90% (never reaching it) until the page arrives.
    timers.current.trickle = window.setInterval(() => {
      set(width.current + (90 - width.current) * 0.12, true);
    }, 200);
    timers.current.safety = window.setTimeout(done, SAFETY_MS);
  };

  // A new page (or new search) arrived: finish the bar.
  useEffect(() => {
    done();
    // done() only reads refs; run it whenever the address changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or just a #jump): nothing to wait for.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      if (!e.defaultPrevented) start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      clear();
    };
    // start/clear only use refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
      <div
        ref={bar}
        className="h-full origin-left bg-gradient-to-r from-brand via-brand to-gold shadow-[0_0_8px_var(--gold)] transition-[transform,opacity] duration-200 ease-out"
        style={{ transform: "scaleX(0)", opacity: 0 }}
      />
    </div>
  );
}
