import Link from "next/link";
import { errorField } from "@/lib/errors";
import { ArrowRight, Building2 } from "lucide-react";
import {
  Field,
  HarvestAddressField,
  PalayCountFields,
  SectionHeading,
  ServicePicker,
} from "@/components/rps/intake-fields";
import { PageTitle } from "@/components/rps/page-title";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ErrorNote } from "@/components/rps/error-note";
import { isStaff } from "@/lib/roles";
import { getSettings, requireRole } from "@/lib/session";
import { formatPhMobile } from "@/lib/phone";
import { requestService } from "../actions";

export default async function RequestServicePage({ searchParams }: PageProps<"/my/request">) {
  const { profile, supabase } = await requireRole((r) => !isStaff(r));
  const { coop_name } = await getSettings();
  const { error } = await searchParams;

  // Earliest date someone can ask for: today, in the Philippines.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // Days already full in the next 60 days (Ticket 41). Dates only: the
  // database never tells a customer who booked them.
  const until = new Date(Date.parse(`${today}T00:00:00Z`) + 60 * 86_400_000).toISOString().slice(0, 10);
  const { data: fullRows } = await supabase.rpc("full_days", { from_date: today, to_date: until });
  const fullDays = ((fullRows ?? []) as string[]).map((d) => String(d));
  const dayLabel = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        eyebrow="Service request"
        title="Request a service"
        description="Tell the co-op what you need. They will accept your request or let you know why not."
      />

      <form
        action={requestService}
        className="group rounded-2xl border border-line bg-card p-5 shadow-card md:p-8"
      >
        <ErrorNote code={error} />

        <SectionHeading title="Cooperative" text="Where your palay will be processed." />
        <div className="flex items-center gap-4 rounded-2xl border-2 border-brand bg-brand-soft p-4">
          <span className="grid size-12 place-items-center rounded-xl bg-brand text-on-brand">
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

        <SectionHeading
          title="Your contact details"
          text="Who the co-op should ask for, and a number they can call or text about this request."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            name="customer_name"
            invalid={errorField(error) === "customer_name"}
            type="text"
            autoComplete="name"
            maxLength={120}
            defaultValue={profile.full_name}
            required
          />
          <Field
            label="Mobile number"
            name="contact_phone"
            invalid={errorField(error) === "contact_phone"}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="0917 123 4567"
            defaultValue={formatPhMobile(profile.phone)}
            required
          />
        </div>

        <div className="my-8 border-t border-line" />

        <ServicePicker text="Choose what the co-op should do with your palay." />
        <HarvestAddressField invalidField={errorField(error)} />

        <div className="my-8 border-t border-line" />

        <SectionHeading
          title="Your palay"
          text="Your best estimate is fine. The co-op weighs it properly."
        />
        <PalayCountFields invalidField={errorField(error)} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Field
              label="Preferred date"
              name="preferred_date"
              type="date"
              min={today}
              invalid={errorField(error) === "preferred_date"}
            />
            {fullDays.length > 0 ? (
              <div className="mt-2 rounded-xl bg-gold-soft p-3 text-xs text-ink">
                <p className="font-bold">Already booked — please pick another day:</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {fullDays.map((d) => (
                    <li key={d} className="rounded-full bg-card px-2 py-0.5 font-semibold tabular-nums line-through decoration-danger/70">
                      {dayLabel(d)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Every day in the next two months is open.</p>
            )}
          </div>
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
          <SubmitButton size="lg">
            Send request
            <ArrowRight className="size-[17px]" aria-hidden />
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
