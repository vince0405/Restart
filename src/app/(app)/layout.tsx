import { redirect } from "next/navigation";
import { BottomNav, Sidebar, TopBar } from "@/components/rps/app-nav";
import { createClient } from "@/lib/supabase/server";

// Wraps every signed-in screen (Dashboard, Jobs, Storage, ...) with the
// sidebar, top bar and phone tab bar. The (app) folder name is in brackets,
// so it groups these pages without adding anything to their web address.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Sidebar email={user.email ?? "Monitor"} />
      <div className="lg:pl-64">
        <TopBar />
        <main className="mx-auto max-w-screen-2xl px-4 pb-28 pt-6 md:px-8 lg:px-10 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
