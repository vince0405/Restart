import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Droplet,
  Gauge,
  HandCoins,
  History,
  Menu,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sprout,
  Users,
  Warehouse,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/rps/logo";
import { SERVICES } from "@/components/rps/intake-fields";
import { ThemeButton } from "@/components/rps/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { stepsFor } from "@/lib/loads";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "RPS1 · Rice Processing System app for cooperatives",
  description:
    "RPS1 helps farmer cooperatives run their Rice Processing System: requests, harvesting, drying, milling, storage and payments, from any phone.",
};

// The public landing page (Ticket 43). Signed-out visitors to "/" see this
// (src/proxy.ts rewrites "/" here); signed-in people get their dashboard.
// Facts about the government's RPS1 come from the sources in the footer.

const TABS = [
  { href: "#about", label: "About" },
  { href: "#how", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#features", label: "Features" },
  { href: "#coops", label: "Co-ops" },
  { href: "#faq", label: "FAQ" },
];

const FACTS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "1.5 t/hr", label: "multi-stage rice mill in an RPS1", icon: Gauge },
  { value: "2 × 6 t", label: "recirculating dryers per batch", icon: Droplet },
  { value: "14%", label: "moisture: dry enough to mill and store safely", icon: Sprout },
  { value: "16.47%", label: "of grain lost after harvest (2010 study)", icon: Wheat },
];

const STEPS: { title: string; text: string; icon: LucideIcon }[] = [
  {
    title: "Request",
    text: "Farmers ask for a service from their phone, pick a day that's still open, and leave a contact number.",
    icon: Smartphone,
  },
  {
    title: "Accepted",
    text: "The co-op accepts or explains why not. Walk-in customers are logged at the counter.",
    icon: ClipboardCheck,
  },
  {
    title: "Harvest, dry, mill",
    text: "Staff tap each transaction through only the steps its service has, recording sacks and kilos as they go.",
    icon: Wheat,
  },
  {
    title: "Keep, sell or split",
    text: "Once weighed, the farmer chooses what to take home and what to sell to the co-op.",
    icon: HandCoins,
  },
  {
    title: "Pay and claim",
    text: "Fees come from the co-op's price list. Every payment gets a receipt, and stored grain is watched for expiry.",
    icon: ReceiptText,
  },
];

const FOR_FARMERS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Request from your phone", text: "No trip to the mill just to ask.", icon: Smartphone },
  { title: "See where your palay is", text: "Harvesting, drying, milling, ready — at a glance.", icon: Bell },
  { title: "Book an open day", text: "Days that are already full are shown before you pick.", icon: CalendarCheck },
  { title: "Receipts for every payment", text: "Cash, GCash, Maya or bank — printable.", icon: ReceiptText },
];

const FOR_STAFF: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Every transaction in one list", text: "Search, filter by service or status, newest first.", icon: ClipboardCheck },
  { title: "Fees worked out for you", text: "Harvest share in pesos or palay, shared dryer loads, milling per sack.", icon: HandCoins },
  { title: "Storage and supply", text: "Expiry warnings for stored grain, and a low-supply alert for the co-op's stock.", icon: Warehouse },
  { title: "Statistics and history", text: "Week, month and year charts, and a record of every change.", icon: BarChart3 },
  { title: "Roles that fit the co-op", text: "Operator, Monitor, Chairperson and a read-only Auditor.", icon: Users },
  { title: "Private and secure", text: "Each co-op sees only its own people, transactions and money.", icon: ShieldCheck },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is RPS1?",
    a: "“RPS1” is the Department of Agriculture's Rice Processing System 1: a 1.5-tonne-per-hour multi-stage rice mill with two recirculating dryers, given through PhilMech under the Rice Competitiveness Enhancement Fund (RCEF) to farmer cooperatives and towns. This app helps a cooperative run its RPS day to day.",
  },
  {
    q: "Who can use the app?",
    a: "Farmers (members and non-members) request services and follow their palay. Co-op staff run each transaction, record payments and watch storage. Each cooperative has its own Chairperson, staff and customers.",
  },
  {
    q: "Does it cost anything to sign up?",
    a: "Creating a customer account is free. The fees you pay are your cooperative's own price list for harvesting, drying and milling.",
  },
  {
    q: "I sign in with my mobile number and forgot my password. What now?",
    a: "If you added an email, use “Forgot password?” on the sign-in page. Mobile-only accounts can't reset by text yet; please contact your cooperative.",
  },
  {
    q: "Is my information private?",
    a: "Yes. You see only your own requests, transactions and receipts. Staff see only their own cooperative, and every change is recorded.",
  },
];

const SOURCES = [
  {
    label: "Daily Tribune — DA-PhilMech turns over Rice Processing System 1 (Oct 2026)",
    href: "https://tribune.net.ph/2026/10/09/da-philmech-turns-over-p1851m-rice-processing-system-to-pastrana",
  },
  {
    label: "IBC 13 — Rice Processing System improving farmers' incomes",
    href: "https://ibctv13.com/rice-processing-system-improving-farmers-incomes-boosting-grain-yields/",
  },
  {
    label: "Province of Iloilo — Batad gets P7.9M rice warehouse (Mar 2026)",
    href: "https://iloilo.gov.ph/en/agriculture-news/batad-gets-p79m-rice-warehouse-post-harvest-support",
  },
  {
    label: "PhilRice — Why wet and dry palay are priced differently (14% moisture)",
    href: "https://www.philrice.gov.ph/bakit-magkaiba-ang-presyo-ng-sariwa-at-tuyong-palay",
  },
  {
    label: "PhilMech–PhilRice postharvest loss assessment (16.47%), via APEC FLOWS",
    href: "https://apec-flows.ntu.edu.tw/upload/edit/file/APEC2019503.pdf",
  },
];

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-brand">{eyebrow}</div>
      <h2 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">{title}</h2>
      {text && <p className="mt-2 text-muted-foreground">{text}</p>}
    </div>
  );
}

export default async function WelcomePage() {
  // Signed in? The nav offers the dashboard instead of Log in / Sign up.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The co-ops using RPS1 (names and towns only — the same list sign-up shows).
  const { data: coopRows } = await supabase.rpc("list_cooperatives");
  const coops = (coopRows ?? []) as { id: string; name: string; town: string }[];

  const authButtons = user ? (
    <Link href="/" className={buttonVariants({ size: "sm" })}>
      Open RPS1
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  ) : (
    <>
      <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Log in
      </Link>
      <Link href="/signup" className={buttonVariants({ size: "sm" })}>
        Sign up
      </Link>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col text-ink">
      {/* ---------- Top navigation ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
          <Link href="/welcome" aria-label="RPS1 home">
            <Logo />
          </Link>
          <ul className="ml-6 hidden items-center gap-1 lg:flex">
            {TABS.map((t) => (
              <li key={t.href}>
                <a
                  href={t.href}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-2">
            <ThemeButton />
            <div className="hidden items-center gap-2 sm:flex">{authButtons}</div>
            {/* Phones and tablets: the tabs fold into a menu (no script needed). */}
            <details className="group/menu relative lg:hidden">
              <summary
                aria-label="Menu"
                className="grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-line bg-card text-ink [&::-webkit-details-marker]:hidden"
              >
                <Menu className="size-5 group-open/menu:hidden" aria-hidden />
                <X className="hidden size-5 group-open/menu:block" aria-hidden />
              </summary>
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-line bg-card p-2 shadow-card">
                <ul className="flex flex-col">
                  {TABS.map((t) => (
                    <li key={t.href}>
                      <a href={t.href} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink hover:bg-surface">
                        {t.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-col gap-2 border-t border-line p-2 sm:hidden">{authButtons}</div>
              </div>
            </details>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:px-8 md:pt-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-bold text-brand shadow-card">
              <BadgeCheck className="size-4" aria-hidden />
              For farmer cooperatives running a Rice Processing System
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-ink md:text-5xl">
              Every palay load, from <span className="text-brand">harvest</span> to{" "}
              <span className="text-gold-dark">payment</span>.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              RPS1 is a phone app for the co-op&rsquo;s rice mill. Farmers request harvesting, drying
              and milling; staff follow every transaction step by step; payments, receipts and stored
              grain stay on record — no more notebooks and loose slips.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Link href="/" className={buttonVariants({ size: "lg" })}>
                  Open RPS1
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              ) : (
                <>
                  <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                    Sign up — request a service
                    <ArrowRight className="size-5" aria-hidden />
                  </Link>
                  <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free for farmers · Works on any phone · Light and dark mode</p>
          </div>

          {/* A picture of the app: one transaction moving through its steps. */}
          <div aria-hidden className="relative">
            <div className="rounded-3xl border border-line bg-card p-5 shadow-card md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transaction</div>
                  <div className="text-lg font-extrabold text-ink">#RPS-1A2B3 · Package Deal</div>
                </div>
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold-dark">Milling</span>
              </div>
              <ol className="mt-6 grid grid-cols-5 gap-2">
                {["Harvesting", "Drying", "Milling", "Ready", "Released"].map((s, i) => (
                  <li key={s} className="flex flex-col items-center gap-2 text-center">
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-full text-xs font-extrabold",
                        i < 2 ? "bg-brand text-on-brand" : i === 2 ? "bg-gold text-on-gold" : "bg-surface text-muted-foreground",
                      )}
                    >
                      {i < 2 ? "✓" : i + 1}
                    </span>
                    <span className="text-[11px] font-semibold leading-tight text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ol>
              <dl className="mt-6 grid grid-cols-3 gap-3 rounded-2xl bg-surface p-3 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">Sacks</dt>
                  <dd className="font-extrabold text-ink">55</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Weight</dt>
                  <dd className="font-extrabold text-ink">2,700 kg</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fee</dt>
                  <dd className="font-extrabold text-ink">₱18.7k</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-line p-3 text-sm">
                <span className="font-semibold text-ink">Payment · GCash</span>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">Receipt ready</span>
              </div>
            </div>
            <div className="absolute -bottom-12 -left-3 hidden rounded-2xl border border-line bg-card px-4 py-3 text-sm shadow-card sm:block">
              <span className="font-extrabold text-ink">Shared dryer load</span>
              <span className="block text-xs text-muted-foreground">60 + 70 sacks · fee split by sacks</span>
            </div>
          </div>
        </section>

        {/* ---------- About ---------- */}
        <section id="about" className="scroll-mt-20 border-y border-line bg-card/70 py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <SectionTitle
              eyebrow="About"
              title="What is RPS1?"
              text="The Department of Agriculture's Rice Processing System 1 is modern drying and milling equipment given through PhilMech, under the Rice Competitiveness Enhancement Fund (RCEF), to farmer cooperatives and towns in rice-growing provinces. Its goal: less grain lost after harvest, better rice, and higher farm incomes."
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {FACTS.map((f) => (
                <div key={f.label} className="rounded-2xl border border-line bg-card p-5 shadow-card">
                  <f.icon className="size-6 text-brand" aria-hidden />
                  <div className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{f.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{f.label}</div>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border-l-4 border-gold bg-gold-soft/60 p-5 text-ink">
              <p className="font-bold">The machines are only half the job.</p>
              <p className="mt-1 text-sm">
                A co-op running an RPS also has to track every farmer&rsquo;s palay: which service it
                is, which step it&rsquo;s at, how much it weighed, what&rsquo;s owed and paid, and
                what&rsquo;s stored before it spoils. That usually lives in a notebook, on slips and in
                people&rsquo;s memory. <strong>The RPS1 app puts it all in one place</strong> — built
                first for Batad Multipurpose Cooperative in Iloilo, which runs the warehouse beside
                Batad&rsquo;s Rice Processing System building.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-8">
          <SectionTitle eyebrow="How it works" title="One transaction, five simple steps" />
          <ol className="grid gap-4 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line bg-card p-5 shadow-card">
                <span className="absolute right-4 top-4 text-3xl font-extrabold text-line">{i + 1}</span>
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-extrabold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Services ---------- */}
        <section id="services" className="scroll-mt-20 border-y border-line bg-card/70 py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <SectionTitle
              eyebrow="Services"
              title="Four services, each with only the steps it needs"
              text="Fees come from your cooperative's own price list: a harvest share (in pesos or in palay), drying per dryer load, and milling per sack."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((s) => (
                <div key={s.name} className="flex flex-col rounded-2xl border border-line bg-card p-5 shadow-card">
                  <span className="grid size-12 place-items-center rounded-xl bg-gold-soft text-gold-dark">
                    <s.icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold text-ink">{s.name}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-4 text-xs font-bold text-brand">{stepsFor(s.name).join(" → ")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-8">
          <SectionTitle eyebrow="Features" title="Made for farmers and for the co-op" />
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-3xl border border-line bg-brand p-6 text-on-brand shadow-card">
              <h3 className="flex items-center gap-2 text-lg font-extrabold">
                <Sprout className="size-5" aria-hidden />
                For farmers
              </h3>
              <ul className="mt-4 space-y-4">
                {FOR_FARMERS.map((f) => (
                  <li key={f.title} className="flex gap-3">
                    <f.icon className="mt-0.5 size-5 shrink-0 opacity-90" aria-hidden />
                    <span>
                      <span className="block font-bold">{f.title}</span>
                      <span className="block text-sm opacity-90">{f.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-line bg-card p-6 shadow-card">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-ink">
                <Building2 className="size-5 text-brand" aria-hidden />
                For co-op staff
              </h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {FOR_STAFF.map((f) => (
                  <li key={f.title} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <f.icon className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-bold text-ink">{f.title}</span>
                      <span className="block text-sm text-muted-foreground">{f.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Co-ops ---------- */}
        <section id="coops" className="scroll-mt-20 border-y border-line bg-card/70 py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <SectionTitle
              eyebrow="Cooperatives"
              title="Co-ops using RPS1"
              text="Each cooperative has its own staff, customers, prices and records. Choose yours when you sign up."
            />
            {coops.length > 0 ? (
              <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
                {coops.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-card">
                    <Building2 className="size-5 text-brand" aria-hidden />
                    <span>
                      <span className="block font-bold text-ink">{c.name}</span>
                      {c.town && <span className="block text-xs text-muted-foreground">{c.town}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-muted-foreground">The list of cooperatives will appear here.</p>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Is your co-op running a Rice Processing System? Ask the RPS1 admin to add it.
            </p>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 md:px-8">
          <SectionTitle eyebrow="FAQ" title="Questions farmers and co-ops ask" />
          <div className="flex flex-col gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group/faq rounded-2xl border border-line bg-card p-4 shadow-card">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-xl text-brand transition-transform group-open/faq:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Call to action ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-brand px-6 py-12 text-center text-on-brand shadow-logo">
            <History className="size-8 opacity-90" aria-hidden />
            <h2 className="text-2xl font-extrabold md:text-3xl">Leave the notebook at home.</h2>
            <p className="max-w-xl opacity-90">
              Request your next harvest, drying or milling from your phone, and always know where your
              palay is.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Link href="/" className={cn(buttonVariants({ size: "lg" }), "bg-gold text-on-gold hover:bg-gold")}>
                  Open RPS1
                </Link>
              ) : (
                <>
                  <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-gold text-on-gold hover:bg-gold")}>
                    Create a free account
                  </Link>
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-on-brand/40 bg-transparent text-on-brand hover:bg-on-brand/10")}
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-line bg-card/80">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_1.6fr] md:px-8">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              A student-built app for farmer cooperatives running a Rice Processing System. Not an
              official Department of Agriculture or PhilMech website.
            </p>
            <div className="mt-4 flex gap-2">
              {!user && (
                <>
                  <Link href="/login" className="text-sm font-bold text-brand">
                    Log in
                  </Link>
                  <span className="text-muted-foreground">·</span>
                  <Link href="/signup" className="text-sm font-bold text-brand">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-ink">Sources for the facts on this page</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {SOURCES.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline-offset-2 hover:text-brand hover:underline">
                    {s.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
