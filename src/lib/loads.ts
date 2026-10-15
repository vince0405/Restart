import type { ErrorCode } from "@/lib/errors";

// The fixed vocabulary of the app, in one place so the form, the detail
// screen and the database all agree.

export const SERVICE_TYPES = [
  "Package Deal",
  "Harvesting + Drying",
  "Drying only",
  "Milling only",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

// Every step a load can be at, across all services.
export const STAGES = [
  "Received",
  "Harvesting",
  "Drying",
  "Milling",
  "Ready",
  "Stored",
  "Released",
] as const;

export type Stage = (typeof STAGES)[number];

// The steps each service goes through, in order. Ready means the work is
// done and the grain is waiting for the customer.
const STEPS: Record<ServiceType, readonly Stage[]> = {
  "Package Deal": ["Harvesting", "Drying", "Milling", "Ready", "Released"],
  "Harvesting + Drying": ["Harvesting", "Drying", "Ready", "Released"],
  "Drying only": ["Received", "Drying", "Ready", "Released"],
  "Milling only": ["Received", "Milling", "Ready", "Released"],
};

export function isServiceType(value: string): value is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

/**
 * The steps this service goes through, in order. A load that was stored
 * at the mill has an extra Stored step just before Released.
 */
export function stepsFor(service: ServiceType, stored = false): readonly Stage[] {
  const steps = STEPS[service];
  if (!stored) return steps;
  return [...steps.slice(0, -1), "Stored", "Released"];
}

/** Services with a Harvesting step need the farm address. */
export function needsHarvestAddress(service: ServiceType): boolean {
  return STEPS[service].includes("Harvesting");
}

/**
 * The farm address from a form: required (and at most 300 characters) for
 * services that harvest, ignored for the rest.
 */
export function parseHarvestAddress(
  service: ServiceType,
  raw: unknown,
): ParseResult<string | null> {
  if (!needsHarvestAddress(service)) return { ok: true, value: null };
  const address = String(raw ?? "").trim();
  if (!address || address.length > 300) return { ok: false, error: "address_required" };
  return { ok: true, value: address };
}

/**
 * Leaving these steps, staff must record the new sacks and weight: after
 * harvesting (first count) and after drying (palay shrinks as it dries).
 */
export function countsAfter(stage: Stage): "harvesting" | "drying" | null {
  if (stage === "Harvesting") return "harvesting";
  if (stage === "Drying") return "drying";
  return null;
}

/** Sacks and weight as people should read them ("not counted yet" = 0 / 0). */
export function describeCount(load: { sacks: number; kilos: number; service_type: string }): string {
  if (load.sacks === 0 && load.kilos === 0 && isServiceType(load.service_type) && needsHarvestAddress(load.service_type)) {
    return "To be counted after harvest";
  }
  const kg = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(load.kilos);
  return `${load.sacks} ${load.sacks === 1 ? "sack" : "sacks"} · ${kg} kg`;
}

/** The sacks and weight staff record after harvesting or drying. */
export function parseCount(rawSacks: unknown, rawKilos: unknown): ParseResult<{ sacks: number; kilos: number }> {
  const sacks = parseNumber(rawSacks);
  if (sacks === null || !Number.isInteger(sacks) || sacks < 0) return { ok: false, error: "sacks_invalid" };
  const kilos = parseNumber(rawKilos);
  if (kilos === null || kilos < 0) return { ok: false, error: "kilos_invalid" };
  return { ok: true, value: { sacks, kilos } };
}

/** Where a new load of this service starts. */
export function firstStage(service: ServiceType): Stage {
  return STEPS[service][0];
}

/** The step after this one for this service, or null at the end. */
export function nextStage(
  service: ServiceType,
  stage: Stage,
  stored = false,
): Stage | null {
  const steps = stepsFor(service, stored);
  const i = steps.indexOf(stage);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

/** The step before this one for this service, or null at the start. */
export function prevStage(
  service: ServiceType,
  stage: Stage,
  stored = false,
): Stage | null {
  const steps = stepsFor(service, stored);
  const i = steps.indexOf(stage);
  return i > 0 ? steps[i - 1] : null;
}

// ---- Storage ------------------------------------------------------------

/** What the mill hands back: rice if the service includes milling. */
export function productFor(service: ServiceType): "rice" | "palay" {
  return STEPS[service].includes("Milling") ? "rice" : "palay";
}

/** How many days stored grain keeps. The real numbers live in the
 *  `settings` table; these are the defaults (rice 30 days, palay 90). */
export type Lifeline = { rice: number; palay: number };
export const DEFAULT_LIFELINE: Lifeline = { rice: 30, palay: 90 };

/** The date stored grain goes bad: the day it was stored plus its lifeline. */
export function expiryDate(
  storedAt: Date,
  service: ServiceType,
  lifeline: Lifeline = DEFAULT_LIFELINE,
): Date {
  return new Date(storedAt.getTime() + lifeline[productFor(service)] * 86_400_000);
}

/** Whole days from now until the expiry date. Negative once expired. */
export function daysLeft(expiry: Date, now: Date = new Date()): number {
  return Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
}

/** The warning point: stored grain with this many days or fewer left
 *  counts as "expiring soon". The co-op's own number lives in
 *  settings.warning_days; this is the default (14, from the flowchart). */
export const EXPIRY_WARNING_DAYS = 14;

/** Urgent (red) in the last week, or once expired. */
export const EXPIRY_URGENT_DAYS = 7;

/** Red (urgent), amber (within the warning period) or green, by days left. */
export function expiryTone(
  days: number,
  warningDays: number = EXPIRY_WARNING_DAYS,
): "red" | "amber" | "green" {
  if (days <= Math.min(EXPIRY_URGENT_DAYS, warningDays)) return "red";
  if (days <= warningDays) return "amber";
  return "green";
}

/** "Expired", "1 day left", "12 days left". */
export function expiryLabel(days: number): string {
  if (days <= 0) return "Expired";
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

// ---- Job references and the dashboard ----------------------------------

/** A short, readable job reference made from the database id. */
export function jobRef(id: string): string {
  return `RPS-${id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;
}

/** The columns of a load the dashboard needs. */
export type LoadRow = {
  id: string;
  created_at: string;
  customer_name: string;
  sacks: number;
  kilos: number;
  service_type: string;
  stage: string;
  agreed_price: number;
  is_paid: boolean;
  amount_paid: number | null;
  stored_at: string | null;
  customer_id?: string | null;
  request_status?: string;
  output_kg?: number | null;
  disposition?: string | null;
  keep_percent?: number | null;
  buyout_status?: string;
  price_per_kg?: number | null;
  payout_done_at?: string | null;
  reject_reason?: string | null;
  preferred_date?: string | null;
  customer_note?: string | null;
  cancelled_at?: string | null;
  harvest_address?: string | null;
  market_price_per_kg?: number | null;
  harvest_fee?: number | null;
  drying_fee?: number | null;
  milling_fee?: number | null;
  /** Staff's change to the price list, kept across counts (negative = discount). */
  fee_adjustment?: number | null;
  /** How the harvest share was paid (Ticket 30), and the palay kept if in palay. */
  harvest_fee_in?: string | null;
  harvest_kept_kg?: number | null;
  /** The shared dryer load this job dried in, if any (Ticket 29). */
  dryer_load_id?: string | null;
};

/** Days left for a stored load, or null if it is not in storage. */
export function storedDaysLeft(
  load: LoadRow,
  now: Date = new Date(),
  lifeline: Lifeline = DEFAULT_LIFELINE,
): number | null {
  if (load.stage !== "Stored" || !load.stored_at || !isServiceType(load.service_type)) {
    return null;
  }
  return daysLeft(expiryDate(new Date(load.stored_at), load.service_type, lifeline), now);
}

/** The headline numbers on the dashboard, worked out from real loads. */
export function summarize(
  loads: LoadRow[],
  now: Date = new Date(),
  lifeline: Lifeline = DEFAULT_LIFELINE,
  warningDays: number = EXPIRY_WARNING_DAYS,
) {
  const manilaDay = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const today = manilaDay(now);

  const summary = {
    activeJobs: 0,
    addedToday: 0,
    palayKg: 0,
    palayLots: 0,
    riceKg: 0,
    riceLots: 0,
    expiringSoon: 0,
    unpaidTotal: 0,
    unpaidCount: 0,
    releasedUnpaid: 0,
  };

  for (const load of loads) {
    if (load.stage !== "Stored" && load.stage !== "Released") summary.activeJobs++;
    if (manilaDay(new Date(load.created_at)) === today) summary.addedToday++;

    const money = settlement(load);

    // Storage counts what the customer KEPT, by output weight.
    if (load.stage === "Stored" && isServiceType(load.service_type)) {
      if (productFor(load.service_type) === "rice") {
        summary.riceKg += money.keptKg;
        summary.riceLots++;
      } else {
        summary.palayKg += money.keptKg;
        summary.palayLots++;
      }
      const left = storedDaysLeft(load, now, lifeline);
      if (left !== null && left <= warningDays) summary.expiringSoon++;
    }

    // "Not yet paid" uses the same maths as the job screen and Money page:
    // a fee covered by a buyout is not owed.
    if (money.stillOwes > 0) {
      summary.unpaidTotal += money.stillOwes;
      summary.unpaidCount++;
      if (load.stage === "Released") summary.releasedUnpaid++;
    }
  }

  return summary;
}

/**
 * When a pending request stops being cancellable: the moment it was asked
 * plus the co-op's cancel window. The database checks the same rule with
 * its own clock; this is only for showing the deadline and hiding the
 * button once it has passed.
 */
export function cancelDeadline(createdAt: string, windowHours: number): Date {
  return new Date(new Date(createdAt).getTime() + windowHours * 3_600_000);
}

/** Is a request asked at createdAt still inside the cancel window? */
export function withinCancelWindow(
  createdAt: string,
  windowHours: number,
  now: Date = new Date(),
): boolean {
  return now.getTime() < cancelDeadline(createdAt, windowHours).getTime();
}

/** What a customer should read about their job, in plain words. */
export function customerStatus(load: LoadRow): {
  label: string;
  tone: "amber" | "red" | "green" | "blue" | "gray";
} {
  if (load.request_status === "cancelled") return { label: "Cancelled", tone: "gray" };
  if (load.request_status === "pending") return { label: "Waiting for the co-op", tone: "amber" };
  if (load.request_status === "rejected") return { label: "Not accepted", tone: "red" };
  if (load.stage === "Released") return { label: "Completed", tone: "gray" };
  if (load.stage === "Stored") return { label: "Stored at the mill", tone: "blue" };
  if (load.stage === "Ready") {
    if (load.output_kg == null) return { label: "Ready, being weighed", tone: "green" };
    if (!load.disposition) return { label: "Ready: choose keep, sell or split", tone: "green" };
    if (load.buyout_status === "requested") return { label: "Waiting for buyout decision", tone: "amber" };
    if (load.buyout_status === "approved") return { label: "Buyout approved", tone: "green" };
    if (load.buyout_status === "declined") return { label: "Buyout declined: please claim", tone: "red" };
    return { label: "Ready to claim", tone: "green" };
  }
  return { label: `In progress: ${load.stage}`, tone: "amber" };
}

// ---- Keep, sell or split, and the buyout -------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Who owes whom once a job is weighed and the customer has chosen.
 *
 *   sale value  = kg sold x price per kg      (only once a buyout is approved)
 *   fee owed    = processing fee - cash already paid
 *   payout      = sale value - fee owed       (if positive, the co-op pays)
 *   still owes  = fee owed - sale value       (if positive, the customer pays)
 */
export function settlement(load: {
  agreed_price: number;
  is_paid: boolean;
  amount_paid: number | null;
  output_kg?: number | null;
  keep_percent?: number | null;
  buyout_status?: string;
  price_per_kg?: number | null;
}) {
  const output = load.output_kg ?? 0;
  // A declined buyout means the customer takes everything home.
  const keepPercent = load.buyout_status === "declined" ? 100 : (load.keep_percent ?? 100);
  const keptKg = round2((output * keepPercent) / 100);
  const soldKg = round2(output - keptKg);
  const approved = load.buyout_status === "approved";
  const saleValue = approved ? round2(soldKg * (load.price_per_kg ?? 0)) : 0;
  const paidCash = load.is_paid ? (load.amount_paid ?? 0) : 0;
  const feeOwed = round2(Math.max(0, load.agreed_price - paidCash));
  const net = round2(saleValue - feeOwed);
  return {
    keptKg,
    soldKg,
    saleValue,
    paidCash,
    feeOwed,
    payout: Math.max(0, net),
    stillOwes: Math.max(0, -net),
  };
}

/**
 * Can this job be released? Only once the fee is settled: paid or covered
 * by an approved buyout — or the customer is a member the Chairperson
 * trusts to pay later (Ticket 31). The database checks the same (017).
 */
export function canRelease(load: Parameters<typeof settlement>[0], payLater = false): boolean {
  return payLater || settlement(load).stillOwes === 0;
}

/** The co-op's money and stock totals, for the Money screen. */
export function moneySummary(loads: LoadRow[]) {
  const totals = {
    cashReceived: 0,
    feesCoveredByBuyouts: 0,
    payoutsMade: 0,
    payoutsToMake: 0,
    owedByCustomers: 0,
    stockRiceKg: 0,
    stockPalayKg: 0,
    buyoutsWaiting: 0,
    /** Palay kept by the co-op as the harvest share (Ticket 30), not pesos. */
    harvestPalayKg: 0,
  };
  for (const load of loads) {
    if (load.request_status && load.request_status !== "accepted") continue;
    const s = settlement(load);
    totals.harvestPalayKg += Number(load.harvest_kept_kg ?? 0);
    totals.cashReceived += s.paidCash;
    totals.owedByCustomers += s.stillOwes;
    if (load.buyout_status === "requested") totals.buyoutsWaiting++;
    if (load.buyout_status === "approved") {
      totals.feesCoveredByBuyouts += Math.min(s.saleValue, s.feeOwed);
      if (load.payout_done_at) totals.payoutsMade += s.payout;
      else totals.payoutsToMake += s.payout;
      if (isServiceType(load.service_type) && productFor(load.service_type) === "rice") {
        totals.stockRiceKg += s.soldKg;
      } else {
        totals.stockPalayKg += s.soldKg;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, round2(v)]),
  ) as typeof totals;
}

/**
 * The summary at the top of a customer's My jobs page, from their own jobs
 * only (RLS never hands a customer anyone else's).
 */
export function customerSummary(
  loads: LoadRow[],
  now: Date = new Date(),
  lifeline: Lifeline = DEFAULT_LIFELINE,
) {
  const summary = {
    waiting: 0, // pending requests
    inProgress: 0, // accepted, still being worked on
    toChoose: 0, // ready and weighed, keep / sell / split not chosen yet
    stored: 0,
    soonestExpiryDays: null as number | null,
    owes: 0,
    toReceive: 0,
  };

  for (const load of loads) {
    if (load.request_status === "pending") {
      summary.waiting++;
      continue;
    }
    if (load.request_status !== "accepted") continue; // rejected or cancelled

    if (load.stage === "Stored") {
      summary.stored++;
      const left = storedDaysLeft(load, now, lifeline);
      if (left !== null && (summary.soonestExpiryDays === null || left < summary.soonestExpiryDays)) {
        summary.soonestExpiryDays = left;
      }
    } else if (load.stage === "Ready" && load.output_kg != null && !load.disposition) {
      summary.toChoose++;
    } else if (load.stage !== "Released") {
      summary.inProgress++;
    }

    const money = settlement(load);
    summary.owes += money.stillOwes;
    if (!load.payout_done_at) summary.toReceive += money.payout;
  }

  summary.owes = round2(summary.owes);
  summary.toReceive = round2(summary.toReceive);
  return summary;
}

/** How far back the Money statistics look. */
export type StatsRange = "6m" | "12m" | "all";

export function parseStatsRange(raw: unknown): StatsRange {
  return raw === "12m" || raw === "all" ? raw : "6m";
}

/**
 * The Money statistics, from accepted jobs only. Grouped by the month the
 * job was LOGGED (Manila time) — the app does not record payment dates.
 *
 *   collected = fee - what the customer still owes
 *               (cash paid, or taken out of an approved buyout)
 */
export function moneyStats(loads: LoadRow[], range: StatsRange, now: Date = new Date()) {
  const monthKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
  const accepted = loads.filter((l) => !l.request_status || l.request_status === "accepted");

  // The months to show, oldest first, ending with this month.
  const thisMonth = monthKey(now);
  let count = range === "12m" ? 12 : 6;
  if (range === "all") {
    const first = accepted.map((l) => monthKey(new Date(l.created_at))).sort()[0] ?? thisMonth;
    const [fy, fm] = first.split("-").map(Number);
    const [ty, tm] = thisMonth.split("-").map(Number);
    count = Math.min(24, Math.max(1, (ty - fy) * 12 + (tm - fm) + 1));
  }
  const [ty, tm] = thisMonth.split("-").map(Number);
  const months = Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 1 - (count - 1 - i), 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" });
    return { key, label, year: d.getUTCFullYear(), collected: 0, owed: 0, jobs: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));

  const services = new Map<string, { service: string; jobs: number; fees: number }>();
  const totals = { jobs: 0, fees: 0, collected: 0, owed: 0, boughtKg: 0 };

  for (const load of accepted) {
    const month = byKey.get(monthKey(new Date(load.created_at)));
    if (!month) continue; // outside the chosen range
    const s = settlement(load);
    const collected = round2(load.agreed_price - s.stillOwes);
    month.collected = round2(month.collected + collected);
    month.owed = round2(month.owed + s.stillOwes);
    month.jobs++;

    const svc = services.get(load.service_type) ?? { service: load.service_type, jobs: 0, fees: 0 };
    svc.jobs++;
    svc.fees = round2(svc.fees + load.agreed_price);
    services.set(load.service_type, svc);

    totals.jobs++;
    totals.fees = round2(totals.fees + load.agreed_price);
    totals.collected = round2(totals.collected + collected);
    totals.owed = round2(totals.owed + s.stillOwes);
    if (load.buyout_status === "approved") totals.boughtKg = round2(totals.boughtKg + s.soldKg);
  }

  return {
    months,
    // Every service, most jobs first (services with no jobs show as 0).
    byService: SERVICE_TYPES.map((name) => services.get(name) ?? { service: name, jobs: 0, fees: 0 }).sort(
      (a, b) => b.jobs - a.jobs,
    ),
    totals: {
      ...totals,
      averageFee: totals.jobs ? round2(totals.fees / totals.jobs) : 0,
      collectedShare: totals.fees ? totals.collected / totals.fees : 0,
    },
  };
}

/** Turn a keep / sell / split choice into the database columns. */
export function parseDisposition(
  choice: unknown,
  keepPercentRaw: unknown,
): ParseResult<{ disposition: "keep" | "sell" | "split"; keep_percent: number; buyout_status: "none" | "requested" }> {
  if (choice === "keep") {
    return { ok: true, value: { disposition: "keep", keep_percent: 100, buyout_status: "none" } };
  }
  if (choice === "sell") {
    return { ok: true, value: { disposition: "sell", keep_percent: 0, buyout_status: "requested" } };
  }
  if (choice === "split") {
    const n = Number(String(keepPercentRaw ?? "").trim());
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      return { ok: false, error: "split_invalid" };
    }
    return { ok: true, value: { disposition: "split", keep_percent: n, buyout_status: "requested" } };
  }
  return { ok: false, error: "choice_required" };
}

export type LoadInput = {
  customer_name: string;
  sacks: number;
  kilos: number;
  service_type: ServiceType;
  agreed_price: number;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ErrorCode };

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Turn raw form input into a clean load, or an error message. Kept free of
 * Next.js and Supabase so it can be unit-tested directly.
 */
export function parseLoadInput(raw: {
  customer_name: unknown;
  sacks: unknown;
  kilos: unknown;
  service_type: unknown;
  agreed_price: unknown;
}): ParseResult<LoadInput> {
  const customer_name = String(raw.customer_name ?? "").trim();
  if (customer_name.length === 0) {
    return { ok: false, error: "name_required" };
  }

  const service_type = String(raw.service_type ?? "");
  if (!isServiceType(service_type)) {
    return { ok: false, error: "service_invalid" };
  }

  // Before harvesting nobody knows the sacks or weight yet: the co-op counts
  // them after harvesting. 0 means "not counted yet".
  const harvests = needsHarvestAddress(service_type);
  const blank = (v: unknown) => String(v ?? "").trim() === "";

  const sacks = harvests && blank(raw.sacks) ? 0 : parseNumber(raw.sacks);
  if (sacks === null || !Number.isInteger(sacks) || sacks < 0) {
    return { ok: false, error: "sacks_invalid" };
  }

  const kilos = harvests && blank(raw.kilos) ? 0 : parseNumber(raw.kilos);
  if (kilos === null || kilos < 0) {
    return { ok: false, error: "kilos_invalid" };
  }

  // Left empty = use the price list (the database fills it in).
  const agreed_price = blank(raw.agreed_price) ? 0 : parseNumber(raw.agreed_price);
  if (agreed_price === null || agreed_price < 0) {
    return { ok: false, error: "price_invalid" };
  }

  return {
    ok: true,
    value: { customer_name, sacks, kilos, service_type, agreed_price },
  };
}

/** An amount received must be a number of zero or more. */
export function parseAmountPaid(raw: unknown): ParseResult<number> {
  const n = parseNumber(raw);
  if (n === null || n < 0) {
    return { ok: false, error: "price_invalid" };
  }
  return { ok: true, value: n };
}

/** The details staff may fix after a job is saved (Ticket 35). */
export type JobDetails = {
  customer_name: string;
  harvest_address: string | null;
  customer_note: string | null;
  /** Only when the service changes: the new service, its first step and its intake count. */
  service_type?: ServiceType;
  stage?: Stage;
  sacks?: number;
  kilos?: number;
};

/**
 * Checks the "Edit details" form against the job as it is now. The service
 * can only change while the job is at its first step; the job then moves
 * to the new service's first step. A harvesting service is counted after
 * the harvest (0 / 0); Drying only and Milling only need the sacks and kg.
 * The database checks the same rules (supabase/sql/014).
 */
export function parseJobDetails(
  raw: {
    customer_name: unknown;
    service_type: unknown;
    harvest_address: unknown;
    customer_note: unknown;
    sacks: unknown;
    kilos: unknown;
  },
  current: { service_type: ServiceType; stage: Stage },
): ParseResult<JobDetails> {
  const customer_name = String(raw.customer_name ?? "").trim();
  if (!customer_name || customer_name.length > 120) return { ok: false, error: "name_required" };

  const service = String(raw.service_type ?? current.service_type);
  if (!isServiceType(service)) return { ok: false, error: "service_invalid" };

  const address = parseHarvestAddress(service, raw.harvest_address);
  if (!address.ok) return address;

  const note = String(raw.customer_note ?? "").trim().slice(0, 1000);
  const details: JobDetails = { customer_name, harvest_address: address.value, customer_note: note || null };

  if (service !== current.service_type) {
    if (current.stage !== firstStage(current.service_type)) return { ok: false, error: "service_locked" };
    details.service_type = service;
    details.stage = firstStage(service);
    if (needsHarvestAddress(service)) {
      details.sacks = 0;
      details.kilos = 0;
    } else {
      const count = parseCount(raw.sacks, raw.kilos);
      if (!count.ok) return count;
      details.sacks = count.value.sacks;
      details.kilos = count.value.kilos;
    }
  }
  return { ok: true, value: details };
}

// ---- Payments (Ticket 31) ----------------------------------------------

export const PAYMENT_METHODS = ["cash", "gcash", "maya", "bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank transfer",
};

export function paymentMethodLabel(method: string): string {
  return (PAYMENT_METHOD_LABELS as Record<string, string>)[method] ?? method;
}

/** One payment on a job, as the payments table holds it (supabase/sql/017). */
export type Payment = {
  id: string;
  load_id: string;
  amount: number;
  paid_on: string;
  method: string;
  reference: string | null;
  recorded_by: string | null;
  created_at: string;
};

/**
 * The "Record a payment" form: an amount above 0, a date (YYYY-MM-DD, not
 * in the future), a method from the list and an optional reference number.
 * `today` is the date in Manila, passed in so this stays testable.
 */
export function parsePayment(
  raw: { amount: unknown; paid_on: unknown; method: unknown; reference: unknown },
  today: string,
): ParseResult<{ amount: number; paid_on: string; method: PaymentMethod; reference: string | null }> {
  const amount = parseNumber(raw.amount);
  if (amount === null || amount <= 0) return { ok: false, error: "payment_invalid" };

  const paidOn = String(raw.paid_on ?? "").trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || paidOn > today) return { ok: false, error: "payment_date_invalid" };

  const method = String(raw.method ?? "cash");
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) return { ok: false, error: "payment_invalid" };

  const reference = String(raw.reference ?? "").trim().slice(0, 100);
  return {
    ok: true,
    value: { amount: Math.round(amount * 100) / 100, paid_on: paidOn, method: method as PaymentMethod, reference: reference || null },
  };
}

/** Today's date in Manila, YYYY-MM-DD. */
export function manilaToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/**
 * Recent jobs grouped by the day they were logged (Manila time), newest
 * first: "Today", "Yesterday", then the date ("Mon, 13 Oct").
 */
export function groupByDay<T extends { created_at: string }>(items: T[], now: Date = new Date()) {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const today = day(now);
  const yesterday = day(new Date(now.getTime() - 86_400_000));
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const when = new Date(item.created_at);
    const key = day(when);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const label =
        key === today
          ? "Today"
          : key === yesterday
            ? "Yesterday"
            : when.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short", day: "numeric", month: "short" });
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
