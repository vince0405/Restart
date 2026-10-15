import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/rps/badge";
import { PageTitle } from "@/components/rps/page-title";
import { Button } from "@/components/ui/button";
import { canManagePeople, ROLE_LABELS, ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { updatePerson } from "./actions";

type Person = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  role: keyof typeof ROLE_LABELS;
  is_member: boolean;
};

// Chairperson only: everyone with an account, their role and member flag.
export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const { supabase, user } = await requireRole(canManagePeople);
  const { error, saved } = await searchParams;

  const { data } = await supabase
    .from("profiles")
    .select("id, created_at, full_name, phone, role, is_member")
    .order("created_at", { ascending: false });
  const people = (data ?? []) as Person[];

  return (
    <div>
      <PageTitle
        eyebrow="Chairperson"
        title="People"
        description="Everyone who signed up starts as a Customer. Give staff their role and mark co-op members here."
      />

      {saved && (
        <p className="mb-4 rounded-xl border-l-4 border-brand bg-brand-soft p-3 text-sm font-semibold text-brand">
          Saved.
        </p>
      )}
      {typeof error === "string" && (
        <p className="mb-4 rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
          {error === "role" ? "Choose a role from the list." : error}
        </p>
      )}

      <section className="rounded-2xl border border-line bg-white p-2 shadow-card md:p-3">
        <ul>
          {people.map((p) => (
            <li key={p.id} className="border-b border-line/70 last:border-0">
              <form
                action={updatePerson}
                className="grid items-center gap-3 rounded-xl px-3 py-4 md:grid-cols-[1.6fr_1fr_auto_auto]"
              >
                <input type="hidden" name="id" value={p.id} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">{p.full_name || "(no name)"}</span>
                    {p.id === user.id && <Badge tone="gray">You</Badge>}
                    {p.is_member && (
                      <Badge tone="green">
                        <BadgeCheck className="mr-1 size-3.5" aria-hidden />
                        Member
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.phone || "No phone"}</div>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="sr-only">Role for {p.full_name}</span>
                  <select
                    name="role"
                    defaultValue={p.role}
                    disabled={p.id === user.id}
                    className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  {p.id === user.id && <input type="hidden" name="role" value={p.role} />}
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    name="is_member"
                    defaultChecked={p.is_member}
                    className="size-5 accent-[var(--brand)]"
                  />
                  Member
                </label>
                <Button type="submit" variant="outline">
                  Save
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
