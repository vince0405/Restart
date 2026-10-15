"use client";

// The navigation around every signed-in screen: a sidebar on laptops, a top
// bar everywhere, and a tab bar along the bottom on phones. It is a client
// component only because it needs to know which page is open
// (usePathname) to highlight it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutGrid, LogOut, Plus, Warehouse, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type NavItem = { label: string; href: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutGrid },
  { label: "Jobs", href: "/loads", icon: ClipboardList },
  { label: "Storage", href: "/storage", icon: Warehouse },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/loads") return pathname.startsWith("/loads") && pathname !== "/loads/new";
  return pathname.startsWith(href);
}

function titleFor(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/loads/new") return "New load";
  if (pathname.startsWith("/loads/")) return "Job details";
  if (pathname.startsWith("/loads")) return "Jobs";
  if (pathname.startsWith("/storage")) return "Storage";
  return "RPS1";
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
      <div className="px-3">
        <Logo />
      </div>
      <nav className="mt-10 flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                active
                  ? "bg-brand-soft text-brand"
                  : "text-muted-foreground hover:bg-surface hover:text-ink",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              <span>{item.label}</span>
              {active && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
            </Link>
          );
        })}
      </nav>
      <div className="rounded-2xl bg-surface p-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold uppercase text-brand">
            {email.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{email}</div>
            <div className="text-xs text-muted-foreground">Monitor</div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-white hover:text-danger"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/90 px-4 py-3 backdrop-blur-md md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="hidden flex-1 lg:block">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            RPS1 Operations
          </div>
          <div className="text-xl font-extrabold text-ink">{titleFor(pathname)}</div>
        </div>
        <Link
          href="/loads/new"
          className="ml-auto hidden min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-logo transition hover:bg-brand-dark md:flex"
        >
          <Plus className="size-[18px]" aria-hidden />
          New load
        </Link>
        <form action={signOut} className="ml-auto md:ml-0 lg:hidden">
          <button
            type="submit"
            aria-label="Sign out"
            className="grid size-11 place-items-center rounded-xl border border-line bg-white text-muted-foreground hover:text-danger"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [dashboard, jobs, storage] = NAV;
  const tab = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold",
          active ? "text-brand" : "text-muted-foreground",
        )}
      >
        <item.icon className="size-[21px]" aria-hidden />
        {item.label}
      </Link>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-up lg:hidden">
      {tab(dashboard)}
      {tab(jobs)}
      <Link
        href="/loads/new"
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold",
          pathname === "/loads/new" ? "text-brand" : "text-muted-foreground",
        )}
      >
        <span className="grid size-8 place-items-center rounded-full bg-brand text-white shadow-logo">
          <Plus className="size-5" aria-hidden />
        </span>
        New load
      </Link>
      {tab(storage)}
    </nav>
  );
}
