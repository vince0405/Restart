import { redirect } from "next/navigation";
import { BottomNav, Sidebar, TopBar } from "@/components/rps/app-nav";
import { Notice } from "@/components/rps/notice";
import { getSession } from "@/lib/session";
import { signOut } from "../actions";

// Wraps every signed-in screen with the sidebar, top bar and phone tab bar.
// The (app) folder name is in brackets, so it groups these pages without
// adding anything to their web address. The menus depend on the role.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, isAdmin } = await getSession();
  // The main Admin has their own screen and no co-op (Ticket 34).
  if (isAdmin) redirect("/admin");

  // An account not linked to any co-op can't see or do anything yet.
  if (!profile.coop_id) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Notice tone="info" title="Your account isn't linked to a cooperative">
          Please ask your cooperative&rsquo;s Chairperson or the RPS1 admin to add you.
        </Notice>
        <form action={signOut}>
          <button type="submit" className="mt-4 font-bold text-brand">
            Sign out
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar name={profile.full_name} role={profile.role} isMember={profile.is_member} />
      <div className="lg:pl-64">
        <TopBar role={profile.role} />
        <main className="mx-auto max-w-screen-2xl px-4 pb-28 pt-6 md:px-8 lg:px-10 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>
      <BottomNav role={profile.role} />
    </div>
  );
}
