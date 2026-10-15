"use client";

// Light / Dark / System. The choice is saved on this phone only
// (localStorage); "System" follows the phone's own setting, live.

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Choice = "light" | "dark" | "system";
const KEY = "rps1-theme";

function readChoice(): Choice {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function apply(choice: Choice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function useTheme() {
  const [choice, setChoice] = useState<Choice>("system");

  // Pick up the saved choice once we're in the browser.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage is only possible after mount
    setChoice(readChoice());
  }, []);

  // While on "System", follow the phone switching light/dark.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  const choose = (next: Choice) => {
    setChoice(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice just won't be remembered.
    }
    apply(next);
  };

  return { choice, choose };
}

const OPTIONS: { value: Choice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Phone setting", icon: Monitor },
];

/** One icon button for the top bar: cycles Light -> Dark -> Phone setting. */
export function ThemeButton() {
  const { choice, choose } = useTheme();
  const index = OPTIONS.findIndex((o) => o.value === choice);
  const current = OPTIONS[index];
  const next = OPTIONS[(index + 1) % OPTIONS.length];
  return (
    <button
      type="button"
      onClick={() => choose(next.value)}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      title={`Theme: ${current.label}`}
      className="grid size-11 place-items-center rounded-xl border border-line bg-card text-muted-foreground transition-colors hover:text-ink active:scale-95"
    >
      <current.icon className="size-5" aria-hidden />
    </button>
  );
}

/** The full Light / Dark / Phone setting choice, for the Account page. */
export function ThemeChoice() {
  const { choice, choose } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          onClick={() => choose(o.value)}
          className={cn(
            "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-sm font-bold transition-colors",
            choice === o.value
              ? "border-brand bg-brand-soft text-ink"
              : "border-line bg-card text-muted-foreground hover:text-ink",
          )}
        >
          <o.icon className="size-5" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}
