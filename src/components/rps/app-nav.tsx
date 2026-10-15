"use client";

// The navigation around every signed-in screen: a sidebar on laptops, a top
// bar everywhere, and a tab bar along the bottom on phones. Which links
// appear depends on the person's role. It is a client component only
// because it needs to know which page is open (usePathname) to highlight it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  CircleUser,
  ClipboardList,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Settings,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/actions";
import {
  canManage,
  canManagePeople,
  canSeeMoney,
  isStaff,
  ROLE_LABELS,
  type Role,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type NavItem = { label: string; href: string; icon: LucideIcon; mobile: boolean };

function navFor(role: Role): NavItem[] {
  if (!isStaff(role)) {
    return [
      { label: "My jobs", href: "/my", icon: ClipboardList, mobile: true },
      { label: "Request", href: "/my/request", icon: Plus, mobile: true },
      { label: "Account", href: "/account", icon: CircleUser, mobile: false },
    ];
  }
  const items: NavItem[] = [
    { label: "Dashboard", href: "/", icon: LayoutGrid, mobile: true },
  ];
  if (canManage(role) || role === "auditor") {
    items.push({ label: "Requests", href: "/requests", icon: Inbox, mobile: true });
  }
  items.push(
    { label: "Jobs", href: "/loads", icon: ClipboardList, mobile: true },
    { label: "Storage", href: "/storage", icon: Warehouse, mobile: true },
  );
  if (canSeeMoney(role)) {
    items.push({ label: "Money", href: "/money", icon: ReceiptText, mobile: false });
  }
  if (canManagePeople(role)) {
    items.push(
      { label: "People", href: "/people", icon: Users, mobile: false },
      { label: "Settings", href: "/settings", icon: Settings, mobile: false },
    );
  }
  items.push({ label: "Account", href: "/account", icon: CircleUser, mobile: false });
  return items;
}

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/my") return pathname === href;
  if (href === "/loads") return pathname.startsWith("/loads") && pathname !== "/loads/new";
  return pathname.startsWith(href);
}

function titleFor(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/my") return "My jobs";
  if (pathname === "/my/request") return "Request a service";
  if (pathname.startsWith("/my/")) return "My job";
  if (pathname === "/loads/new") return "New walk-in job";
  if (pathname.startsWith("/loads/")) return "Job details";
  if (pathname.startsWith("/loads")) return "Jobs";
  if (pathname.startsWith("/requests")) return "Requests";
  if (pathname.startsWith("/storage")) return "Storage";
  if (pathname.startsWith("/money")) return "Money";
  if (pathname.startsWith("/people")) return "People";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/more")) return "More";
  if (pathname.startsWith("/account")) return "Account";
  return "RPS1";
}

export function Sidebar({
  name,
  role,
  isMember,
}: {
  name: string;
  role: Role;
  isMember: boolean;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
      <div className="px-3">
        <Logo />
      </div>
      <nav className="mt-10 flex flex-1 flex-col gap-1">
        {navFor(role).map((item) => {
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
            {name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{name}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</div>
            {isMember && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-brand">
                <BadgeCheck className="size-3.5" aria-hidden />
                Member
              </div>
            )}
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

export function TopBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const newHref = isStaff(role) ? (canManage(role) ? "/loads/new" : null) : "/my/request";
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/90 px-4 py-3 backdrop-blur-md md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="hidden flex-1 lg:block">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isStaff(role) ? "RPS1 Operations" : "RPS1 Customer"}
          </div>
          <div className="text-xl font-extrabold text-ink">{titleFor(pathname)}</div>
        </div>
        {newHref && (
          <Link
            href={newHref}
            className="ml-auto hidden min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-logo transition hover:bg-brand-dark md:flex"
          >
            <Plus className="size-[18px]" aria-hidden />
            {isStaff(role) ? "New walk-in job" : "Request a service"}
          </Link>
        )}
        <form action={signOut} className={cn("lg:hidden", newHref ? "ml-auto md:ml-0" : "ml-auto")}>
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

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const all = navFor(role);
  const tabs = all.filter((i) => i.mobile);
  const hasMore = all.some((i) => !i.mobile);
  const cols = tabs.length + (hasMore ? 1 : 0);
  const tabClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold",
      active ? "text-brand" : "text-muted-foreground",
    );
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-up lg:hidden"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {tabs.map((item) => (
        <Link key={item.href} href={item.href} className={tabClass(isActive(pathname, item.href))}>
          <item.icon className="size-[21px]" aria-hidden />
          {item.label}
        </Link>
      ))}
      {hasMore && (
        <Link href="/more" className={tabClass(pathname === "/more")}>
          <Menu className="size-[21px]" aria-hidden />
          More
        </Link>
      )}
    </nav>
  );
}

/** The links that don't fit in the phone tab bar, for the "More" page. */
export function MoreLinks({ role }: { role: Role }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      {navFor(role)
        .filter((i) => !i.mobile)
        .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-14 items-center gap-3 border-b border-line px-5 text-sm font-bold text-ink last:border-0 hover:bg-surface"
          >
            <item.icon className="size-5 text-muted-foreground" aria-hidden />
            {item.label}
          </Link>
        ))}
    </div>
  );
}
