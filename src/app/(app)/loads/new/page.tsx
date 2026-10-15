import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Field, SectionHeading, ServicePicker } from "@/components/rps/intake-fields";
import { PageTitle } from "@/components/rps/page-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { canManage } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { createLoad } from "../actions";

export default async function NewLoadPage({ searchParams }: PageProps<"/loads/new">) {
  await requireRole(canManage);

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

        <ServicePicker text="The job will only show the steps this service has." />

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
