import { BottomNav, Sidebar, TopBar } from "@/components/rps/app-nav";
import { getSession } from "@/lib/session";

// Wraps every signed-in screen with the sidebar, top bar and phone tab bar.
// The (app) folder name is in brackets, so it groups these pages without
// adding anything to their web address. The menus depend on the role.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await getSession();

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
