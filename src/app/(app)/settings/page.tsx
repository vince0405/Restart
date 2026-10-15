import { PageTitle } from "@/components/rps/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canManagePeople } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { updateSettings } from "../people/actions";

const MESSAGES: Record<string, string> = {
  price: "Enter a farmgate price of 0 or more.",
  name: "The co-op needs a name.",
  save: "Could not save. Only the Chairperson can change settings.",
};

// Chairperson only: the co-op's name and farmgate reference price.
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await requireRole(canManagePeople);
  const settings = await getSettings();
  const { error, saved } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Chairperson" title="Settings" description="Applies to every new buyout." />

      {saved && (
        <p className="mb-4 rounded-xl border-l-4 border-brand bg-brand-soft p-3 text-sm font-semibold text-brand">
          Saved.
        </p>
      )}
      {typeof error === "string" && (
        <p className="mb-4 rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
          {MESSAGES[error] ?? "Could not save."}
        </p>
      )}

      <form action={updateSettings} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 shadow-card md:p-7">
        <div className="flex flex-col gap-2">
          <Label htmlFor="coop_name">Cooperative name</Label>
          <Input id="coop_name" name="coop_name" defaultValue={settings.coop_name} maxLength={120} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="farmgate_price_per_kg">Farmgate reference price (₱ per kg)</Label>
          <Input
            id="farmgate_price_per_kg"
            name="farmgate_price_per_kg"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            defaultValue={settings.farmgate_price_per_kg}
            required
          />
          <p className="text-xs text-muted-foreground">
            Pre-fills the price when you approve a buyout. You can still change it per buyout.
          </p>
        </div>

        <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
          Lifeline: rice {settings.lifeline.rice} days, palay {settings.lifeline.palay} days,
          warning at {settings.warning_days} days left. These become Admin settings in Phase 2.
        </div>

        <Button type="submit" size="lg" className="self-start">
          Save settings
        </Button>
      </form>
    </div>
  );
}
