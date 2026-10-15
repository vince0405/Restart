import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import {
  Field,
  HarvestAddressField,
  SectionHeading,
  ServicePicker,
} from "@/components/rps/intake-fields";
import { PageTitle } from "@/components/rps/page-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorNote } from "@/components/rps/error-note";
import { isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { requestService } from "../actions";

export default async function RequestServicePage({ searchParams }: PageProps<"/my/request">) {
  const { profile } = await requireRole((r) => !isStaff(r));
  const { coop_name } = await getSettings();
  const { error } = await searchParams;

  // Earliest date someone can ask for: today, in the Philippines.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        eyebrow="Service request"
        title="Request a service"
        description="Tell the co-op what you need. They will accept your request or let you know why not."
      />

      <form
        action={requestService}
        className="rounded-2xl border border-line bg-white p-5 shadow-card md:p-8"
      >
        <ErrorNote code={error} />

        <SectionHeading title="Cooperative" text="Where your palay will be processed." />
        <div className="flex items-center gap-4 rounded-2xl border-2 border-brand bg-brand-soft p-4">
          <span className="grid size-12 place-items-center rounded-xl bg-brand text-white">
            <Building2 className="size-6" aria-hidden />
          </span>
          <div className="flex-1">
            <div className="font-extrabold text-ink">{coop_name}</div>
            <div className="text-xs text-muted-foreground">
              {profile.is_member
                ? "You are a member: your requests are seen first."
                : "Open to members and non-members. Members are served first."}
            </div>
          </div>
        </div>

        <div className="my-8 border-t border-line" />

        <ServicePicker text="Choose what the co-op should do with your palay." />
        <HarvestAddressField />

        <div className="my-8 border-t border-line" />

        <SectionHeading
          title="Your palay"
          text="Your best estimate is fine. The co-op weighs it properly."
        />
        <div className="grid gap-4 sm:grid-cols-2">
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
            label="Estimated weight"
            name="kilos"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="1250"
            suffix="kg"
            required
          />
          <Field label="Preferred date" name="preferred_date" type="date" min={today} />
          <Field
            label="Note for the co-op (optional)"
            name="customer_note"
            type="text"
            maxLength={500}
            placeholder="e.g. harvest is ready next week"
          />
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
          <Link href="/my" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" size="lg">
            Send request
            <ArrowRight className="size-[17px]" aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  );
}
