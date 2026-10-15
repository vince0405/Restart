import Link from "next/link";
import { errorField } from "@/lib/errors";
import { ArrowRight } from "lucide-react";
import {
  Field,
  HarvestAddressField,
  PalayCountFields,
  PriceList,
  SectionHeading,
  ServicePicker,
} from "@/components/rps/intake-fields";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ErrorNote } from "@/components/rps/error-note";
import { canManage } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { createLoad } from "../actions";

export default async function NewLoadPage({ searchParams }: PageProps<"/loads/new">) {
  await requireRole(canManage);
  const { rates } = await getSettings();

  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        eyebrow="Walk-in customer"
        title="Palay intake"
        description="For a customer without an account. It starts as an accepted job."
      />

      <form
        action={createLoad}
        className="group rounded-2xl border border-line bg-card p-5 shadow-card md:p-8"
      >
        <ErrorNote code={error} />

        <SectionHeading title="Customer" text="Who brought in the palay?" />
        <Field
          label="Customer name"
          name="customer_name"
          invalid={errorField(error) === "customer_name"}
          type="text"
          placeholder="e.g. Rogelio Cruz"
          autoComplete="off"
          required
        />

        <div className="my-8 border-t border-line" />

        <ServicePicker text="The job will only show the steps this service has." />
        <HarvestAddressField invalidField={errorField(error)} />

        <div className="my-8 border-t border-line" />

        <SectionHeading title="Intake details" text="Record the palay received. The fee comes from the price list." />
        <PalayCountFields weightLabel="Total weight" invalidField={errorField(error)} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Agreed price (optional)"
            name="agreed_price"
            invalid={errorField(error) === "agreed_price"}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="Price list"
            suffix="PHP"
          />
        </div>
        <PriceList rates={rates} />

        <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
          <Link href="/loads" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton size="lg">
            Create job
            <ArrowRight className="size-[17px]" aria-hidden />
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
