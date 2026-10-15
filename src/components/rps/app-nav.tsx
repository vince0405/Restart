"use client";

// The navigation around every signed-in screen: a sidebar on laptops, a top
// bar everywhere, and a tab bar along the bottom on phones. Which links
// appear depends on the person's role. It is a client component only
// because it needs to know which page is open (usePathname) to highlight it.

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  CircleUser,
  History,
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
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/actions";
import {
  canManage,
  canManagePeople,
  canSeeHistory,
  canSeeMoney,
  isStaff,
  ROLE_LABELS,
  type Role,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeButton } from "./theme-toggle";

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
  if (canSeeHistory(role)) {
    items.push({ label: "History", href: "/history", icon: History, mobile: false });
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
  if (pathname.startsWith("/history")) return "History";
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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card px-4 py-6 lg:flex">
      <div className="px-3">
        <Logo />
      </div>
      <nav aria-label="Main" className="mt-10 flex flex-1 flex-col gap-1">
        {navFor(role).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // Active = green bar on the left + tint + bold: not colour alone.
                "relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                active
                  ? "bg-brand-soft font-extrabold text-ink before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-brand"
                  : "font-semibold text-muted-foreground hover:bg-surface hover:text-ink",
              )}
            >
              <item.icon className={cn("size-5", active && "text-brand")} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="rounded-2xl bg-surface p-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold uppercase text-brand">
            {name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{name}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</div>
            {isMember && (
              <div className="flex items-center gap-1 text-xs font-semibold text-brand">
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
              className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-card hover:text-danger"
            >
              <LogOut className="size-5" aria-hidden />
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
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-2">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="hidden flex-1 lg:block">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isStaff(role) ? "RPS1 Operations" : "RPS1 Customer"}
          </div>
          <div className="text-xl font-extrabold text-ink">{titleFor(pathname)}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {newHref && (
            <Link
              href={newHref}
              className="hidden min-h-12 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand shadow-logo transition-colors hover:bg-brand-dark active:scale-[0.98] md:flex"
            >
              <Plus className="size-5" aria-hidden />
              {isStaff(role) ? "New walk-in job" : "Request a service"}
            </Link>
          )}
          <ThemeButton />
          <form action={signOut} className="lg:hidden">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="grid size-11 place-items-center rounded-xl border border-line bg-card text-muted-foreground transition-colors hover:text-danger"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

const tabClass = (active: boolean) =>
  cn(
    // 56px tall, 12px labels; the active tab gets a pill behind its icon.
    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs",
    active ? "font-extrabold text-ink" : "font-semibold text-muted-foreground",
  );

const iconPill = (active: boolean) =>
  cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-brand-soft text-brand");

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const all = navFor(role);
  const tabs = all.filter((i) => i.mobile);
  const extra = all.filter((i) => !i.mobile);
  const cols = tabs.length + (extra.length ? 1 : 0);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-card px-1 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-up lg:hidden"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {tabs.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={tabClass(active)}
          >
            <span className={iconPill(active)}>
              <item.icon className="size-5" aria-hidden />
            </span>
            {item.label}
          </Link>
        );
      })}
      {extra.length > 0 && (
        <MoreSheet items={extra} active={extra.some((i) => isActive(pathname, i.href))} />
      )}
    </nav>
  );
}

/**
 * "More" on phones: a sheet that slides up from the bottom with the links
 * that do not fit in the tab bar. Built on the browser's own <dialog>, so it
 * keeps focus inside and closes with Escape or a tap outside.
 */
function MoreSheet({ items, active }: { items: NavItem[]; active: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className={tabClass(active)}
      >
        <span className={iconPill(active)}>
          <Menu className="size-5" aria-hidden />
        </span>
        More
      </button>
      <dialog
        ref={ref}
        aria-label="More"
        onClick={(e) => e.target === ref.current && close()}
        className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-3xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-ink shadow-up backdrop:bg-black/50"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-extrabold">More</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <ul className="overflow-hidden rounded-2xl border border-line">
          {items.map((item) => (
            <li key={item.href} className="border-b border-line last:border-0">
              <Link
                href={item.href}
                onClick={close}
                className="flex min-h-14 items-center gap-3 px-4 text-base font-bold hover:bg-surface"
              >
                <item.icon className="size-5 text-muted-foreground" aria-hidden />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}

/** The links that do not fit in the phone tab bar, for the "More" page. */
export function MoreLinks({ role }: { role: Role }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
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
