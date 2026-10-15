import { PageTitle } from "@/components/rps/page-title";
import { Notice } from "@/components/rps/notice";
import { PriceHistory } from "@/components/rps/price-history";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canManagePeople } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { updateSettings } from "../people/actions";

const MESSAGES: Record<string, string> = {
  price: "Enter a farmgate price of 0 or more.",
  name: "The co-op needs a name.",
  window: "The cancel window must be a whole number of hours from 1 to 24.",
  rates:
    "Check the price list: the harvest share is 0–100%, fees are 0 or more, and a dryer load holds at least 1 whole sack.",
  low_supply: "Low-supply levels must be 0 kg or more.",
  save: "Could not save. Only the Chairperson can change settings.",
};

// Chairperson only: the co-op's name, prices and cancel window.
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await requireRole(canManagePeople);
  const settings = await getSettings();
  const { error, saved } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        eyebrow="Chairperson"
        title="Settings"
        description="Applies to new buyouts and new cancellations from now on."
      />

      {saved && (
        <Notice tone="success">Saved.</Notice>
      )}
      {typeof error === "string" && (
        <Notice tone="error">{MESSAGES[error] ?? "Could not save."}</Notice>
      )}

      <form action={updateSettings} className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5 shadow-card md:p-7">
        <div className="flex flex-col gap-2">
          <Label htmlFor="coop_name">Cooperative name</Label>
          <Input id="coop_name" name="coop_name" defaultValue={settings.coop_name} maxLength={120} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="town">Town</Label>
          <Input id="town" name="town" defaultValue={settings.town} maxLength={120} />
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
            Pre-fills the market price at the harvest count and when you approve a buyout. You
            can still change it each time.
          </p>
          <PriceHistory />
        </div>

        <fieldset className="flex flex-col gap-4 rounded-xl border border-line p-4">
          <legend className="px-1 font-bold text-ink">Price list</legend>
          <p className="text-xs text-muted-foreground">
            Used for the next harvest or drying count. Fees already worked out stay as they are.
          </p>
          <RateField
            name="harvest_share_percent"
            label="Harvesting share (% of the harvested kg)"
            value={settings.rates.harvest_share_percent}
            max={100}
            step={0.01}
          />
          <RateField
            name="dryer_load_fee"
            label="Drying (₱ per dryer load)"
            value={settings.rates.dryer_load_fee}
            step={0.01}
          />
          <RateField
            name="dryer_load_max_sacks"
            label="Sacks in one dryer load (most)"
            value={settings.rates.dryer_load_max_sacks}
            min={1}
            step={1}
          />
          <RateField
            name="milling_fee_per_sack"
            label="Milling (₱ per sack)"
            value={settings.rates.milling_fee_per_sack}
            step={0.01}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl border border-line p-4">
          <legend className="px-1 font-bold text-ink">Low-supply warning</legend>
          <p className="text-xs text-muted-foreground">
            Storage warns when the co-op&rsquo;s own rice or palay is at or below these amounts.
          </p>
          <RateField name="low_rice_kg" label="Milled rice (kg)" value={settings.low_supply.rice} step={0.01} />
          <RateField name="low_palay_kg" label="Palay (kg)" value={settings.low_supply.palay} step={0.01} />
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel_window_hours">Cancel window (hours)</Label>
          <Input
            id="cancel_window_hours"
            name="cancel_window_hours"
            type="number"
            inputMode="numeric"
            min={1}
            max={24}
            step={1}
            defaultValue={settings.cancel_window_hours}
            required
          />
          <p className="text-xs text-muted-foreground">
            How long after sending a request a customer may still cancel it — and only while it
            is still waiting for you. From 1 to 24 hours.
          </p>
        </div>

        <div className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
          Lifeline: rice {settings.lifeline.rice} days, palay {settings.lifeline.palay} days,
          warning at {settings.warning_days} days left. These become Admin settings in Phase 2.
        </div>

        <SubmitButton size="lg" className="self-start">
          Save settings
        </SubmitButton>
      </form>

      <section className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-card md:p-7">
        <h2 className="font-extrabold text-ink">Passwords</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone changes their own password under <strong className="text-ink">Account</strong>. If
          someone forgets theirs and signs in with an email, they can use &ldquo;Forgot password?&rdquo;
          on the sign-in page. People who sign in with a mobile number can&rsquo;t reset it themselves
          yet: that needs text messages, which are not set up.
        </p>
      </section>
    </div>
  );
}

function RateField({
  name,
  label,
  value,
  min = 0,
  max,
  step,
}: {
  name: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        inputMode={step === 1 ? "numeric" : "decimal"}
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        required
      />
    </div>
  );
}
