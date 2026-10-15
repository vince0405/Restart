import type { InputHTMLAttributes } from "react";
import { Cog, Droplet, Leaf, Package, type LucideIcon } from "lucide-react";
import { FORM_ERROR_ID } from "@/lib/errors";
import { type ServiceType, stepsFor } from "@/lib/loads";
import type { Rates } from "@/lib/pricing";

// Pieces shared by the staff walk-in form and the customer request form.

export const SERVICES: { name: ServiceType; description: string; icon: LucideIcon }[] = [
  { name: "Package Deal", description: "Harvesting, drying and milling into rice", icon: Package },
  { name: "Harvesting + Drying", description: "Harvested and dried, returned as palay", icon: Leaf },
  { name: "Drying only", description: "Wet palay to dried palay", icon: Droplet },
  { name: "Milling only", description: "Dried palay to milled rice", icon: Cog },
];

// A text box with an optional unit on the right ("sacks", "kg", "PHP").
export function Field({
  label,
  name,
  suffix,
  invalid,
  ...input
}: {
  /** The server said this field is wrong: red edge + linked message. */
  invalid?: boolean;
  label: string;
  name: string;
  suffix?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-ink">{label}</span>
      <span className={`flex min-h-12 items-center rounded-xl border bg-card px-3 focus-within:border-brand ${invalid ? "border-2 border-danger" : "border-field"} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand`}>
        <input
          name={name}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? FORM_ERROR_ID : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-muted-foreground/70 md:text-sm"
          {...input}
        />
        {suffix && (
          <span className="border-l border-line pl-3 text-xs font-bold text-muted-foreground">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

export function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/** The four big service cards. Sends `service_type` with the form. */
export function ServicePicker({ text }: { text: string }) {
  return (
    <fieldset>
      <legend className="contents">
        <SectionHeading
          title="Choose a service"
          text={text}
        />
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <label
            key={s.name}
            className="flex min-h-28 cursor-pointer items-center gap-4 rounded-2xl border-2 border-line p-4 text-left transition hover:border-brand/30 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
          >
            <input
              type="radio"
              name="service_type"
              value={s.name}
              required
              className="peer sr-only"
            />
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface text-gold-dark peer-checked:bg-brand peer-checked:text-on-brand">
              <s.icon className="size-6" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-extrabold text-ink">{s.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{s.description}</span>
              <span className="mt-2 block text-xs font-bold text-brand">
                {stepsFor(s.name).join(" → ")}
              </span>
            </span>
            <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-field text-xs text-on-brand peer-checked:border-brand peer-checked:bg-brand">
              ✓
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Where to harvest. Needed for Package Deal and Harvesting + Drying. */
export function HarvestAddressField({ invalidField }: { invalidField?: string | null }) {
  return (
    <div className="mt-5">
      <Field
        label="Farm address — where to harvest"
        name="harvest_address"
        invalid={invalidField === "harvest_address"}
        type="text"
        maxLength={300}
        autoComplete="street-address"
        placeholder="e.g. Purok 3, Brgy. Batad, near the chapel"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Needed for <strong>Package Deal</strong> and <strong>Harvesting + Drying</strong> so the
        harvest team can find the field. Leave it empty for drying only or milling only.
      </p>
    </div>
  );
}

// The surrounding <form> needs className="group". These classes hide the
// sacks and weight boxes when a harvesting service is picked (nobody knows
// them before the harvest), and show a note instead — plain CSS, no script.
const HARVEST_PICKED_HIDE =
  "group-has-[input[value='Package_Deal']:checked]:hidden group-has-[input[value='Harvesting_+_Drying']:checked]:hidden";
const HARVEST_PICKED_SHOW =
  "hidden group-has-[input[value='Package_Deal']:checked]:flex group-has-[input[value='Harvesting_+_Drying']:checked]:flex";

/**
 * Sacks and weight. Required for Drying only and Milling only (checked on
 * the server); for harvesting services they are counted after the harvest.
 */
export function PalayCountFields({
  weightLabel = "Estimated weight",
  invalidField,
}: {
  weightLabel?: string;
  invalidField?: string | null;
}) {
  return (
    <>
      <div className={`grid gap-4 sm:grid-cols-2 ${HARVEST_PICKED_HIDE}`}>
        <Field
          label="Number of sacks"
          name="sacks"
          invalid={invalidField === "sacks"}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="25"
          suffix="sacks"
        />
        <Field
          label={weightLabel}
          name="kilos"
          invalid={invalidField === "kilos"}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          placeholder="1250"
          suffix="kg"
        />
      </div>
      <p className={`${HARVEST_PICKED_SHOW} items-start gap-2 rounded-xl bg-gold-soft p-3 text-sm text-ink`}>
        The co-op counts the sacks and weighs the palay after harvesting, and again after
        drying.
      </p>
    </>
  );
}

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** The co-op's rates, so staff and customers know how the fee is made. */
export function PriceList({ rates }: { rates: Rates }) {
  return (
    <div className="mt-4 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
      <p className="font-bold text-ink">Price list</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        <li>
          Harvesting: {rates.harvest_share_percent}% of the harvested kg × the market price of palay that day
        </li>
        <li>
          Drying: {peso.format(rates.dryer_load_fee)} per dryer load (up to {rates.dryer_load_max_sacks} sacks)
        </li>
        <li>Milling: {peso.format(rates.milling_fee_per_sack)} per sack, counted after drying</li>
      </ul>
      <p className="mt-2">
        Leave the price empty to use the price list. Harvesting jobs get their fee after the
        harvest count.
      </p>
    </div>
  );
}
