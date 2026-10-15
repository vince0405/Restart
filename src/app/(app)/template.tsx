import type { ReactNode } from "react";

// A template (unlike a layout) is made fresh on every page change, so each
// new screen gets the gentle "rise in" from globals.css (Ticket 37).
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
