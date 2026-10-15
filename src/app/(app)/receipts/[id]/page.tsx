import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { PrintButton } from "@/components/rps/print-button";
import { buttonVariants } from "@/components/ui/button";
import { jobRef, paymentMethodLabel, type Payment } from "@/lib/loads";
import { isStaff } from "@/lib/roles";
import { getSession, getSettings } from "@/lib/session";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

type Receipt = Payment & {
  load: {
    id: string;
    customer_name: string;
    service_type: string;
    customer: { full_name: string } | null;
  } | null;
};

// One payment's receipt (Ticket 31), to print or screenshot. Staff see any;
// a customer only their own — RLS on payments decides, so anyone else's
// receipt is simply "not found". Not an official BIR receipt.
export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const { supabase, role } = await getSession();
  const settings = await getSettings();
  const { id } = await params;

  const { data } = await supabase
    .from("payments")
    .select("*, load:loads(id, customer_name, service_type, customer:profiles!loads_customer_id_fkey(full_name))")
    .eq("id", id)
    .maybeSingle();
  const receipt = data as Receipt | null;
  if (!receipt || !receipt.load) notFound();

  const staff = isStaff(role);
  let recordedBy: string | null = null;
  if (staff && receipt.recorded_by) {
    const { data: person } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", receipt.recorded_by)
      .maybeSingle();
    recordedBy = (person?.full_name as string) || null;
  }

  const customer = receipt.load.customer?.full_name || receipt.load.customer_name;
  const paidOn = new Date(`${receipt.paid_on}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
  });
  const rows: [string, string][] = [
    ["Customer", customer],
    ["Job", `#${jobRef(receipt.load.id)} · ${receipt.load.service_type}`],
    ["Paid on", paidOn],
    ["Method", paymentMethodLabel(receipt.method)],
    ...(receipt.reference ? ([["Reference", receipt.reference]] as [string, string][]) : []),
    ...(recordedBy ? ([["Recorded by", recordedBy]] as [string, string][]) : []),
  ];

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={staff ? `/loads/${receipt.load.id}` : `/my/${receipt.load.id}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to the job
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-line bg-card p-6 shadow-card print:border-0 print:shadow-none">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <ReceiptText className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-ink">{settings.coop_name}</h1>
            <p className="text-xs text-muted-foreground">Payment receipt · RCPT-{receipt.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="my-6 rounded-xl bg-brand-soft p-4 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount paid</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums text-ink">{peso.format(Number(receipt.amount))}</div>
        </div>

        <dl className="divide-y divide-line text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-bold text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 text-xs text-muted-foreground">
          A record of a payment made to the co-op. This is not an official BIR receipt.
        </p>
      </article>
    </div>
  );
}
