import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Cog, Droplet, Leaf, Package, type LucideIcon } from "lucide-react";
import { PageTitle } from "@/components/rps/page-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { type ServiceType, stepsFor } from "@/lib/loads";
import { createClient } from "@/lib/supabase/server";
import { createLoad } from "../actions";

const SERVICES: { name: ServiceType; description: string; icon: LucideIcon }[] = [
  { name: "Package Deal", description: "Harvesting, drying and milling into rice", icon: Package },
  { name: "Harvesting + Drying", description: "Harvested and dried, returned as palay", icon: Leaf },
  { name: "Drying only", description: "Wet palay to dried palay", icon: Droplet },
  { name: "Milling only", description: "Dried palay to milled rice", icon: Cog },
];

// A text box with an optional unit on the right ("sacks", "kg", "PHP").
function Field({
  label,
  name,
  suffix,
  ...input
}: {
  label: string;
  name: string;
  suffix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-ink">{label}</span>
      <span className="flex min-h-12 items-center rounded-xl border border-line bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft">
        <input
          name={name}
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

function SectionHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default async function NewLoadPage({ searchParams }: PageProps<"/loads/new">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        eyebrow="New transaction"
        title="Palay intake"
        description="Create a processing job for a customer."
      />

      <form
        action={createLoad}
        className="rounded-2xl border border-line bg-white p-5 shadow-card md:p-8"
      >
        {error && (
          <p
            className="mb-6 rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        <SectionHeading title="Customer" text="Who brought in the palay?" />
        <Field
          label="Customer name"
          name="customer_name"
          type="text"
          placeholder="e.g. Rogelio Cruz"
          autoComplete="off"
          required
        />

        <div className="my-8 border-t border-line" />

        <fieldset>
          <legend className="contents">
            <SectionHeading
              title="Choose a service"
              text="The job will only show the steps this service has."
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
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface text-gold-dark peer-checked:bg-brand peer-checked:text-white">
                  <s.icon className="size-6" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-extrabold text-ink">{s.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{s.description}</span>
                  <span className="mt-2 block text-[11px] font-bold text-brand">
                    {stepsFor(s.name).join(" → ")}
                  </span>
                </span>
                <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-line text-[10px] text-white peer-checked:border-brand peer-checked:bg-brand">
                  ✓
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="my-8 border-t border-line" />

        <SectionHeading title="Intake details" text="Record the palay received and the agreed price." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Number of sacks"
            name="sacks"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="25"
            suffix="sacks"
            required
          />
          <Field
            label="Total weight"
            name="kilos"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="1250"
            suffix="kg"
            required
          />
          <Field
            label="Agreed price"
            name="agreed_price"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="5000"
            suffix="PHP"
            required
          />
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
          <Link href="/loads" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" size="lg">
            Create job
            <ArrowRight className="size-[17px]" aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  );
}
