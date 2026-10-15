import { MoreLinks } from "@/components/rps/app-nav";
import { PageTitle } from "@/components/rps/page-title";
import { getSession } from "@/lib/session";

// On phones, the links that don't fit in the bottom tab bar live here.
export default async function MorePage() {
  const { role } = await getSession();
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="More" description="Other screens for your role." />
      <MoreLinks role={role} />
    </div>
  );
}
