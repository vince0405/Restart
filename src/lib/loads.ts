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

/** Urgent (red) when this many days or fewer are left, or expired. */
export const EXPIRY_WARNING_DAYS = 7;

/** Worth a heads-up (amber) when this many days or fewer are left. */
export const EXPIRY_SOON_DAYS = 14;

/** Red, amber or green for a stored load, by days left. */
export function expiryTone(days: number): "red" | "amber" | "green" {
  if (days <= EXPIRY_WARNING_DAYS) return "red";
  if (days <= EXPIRY_SOON_DAYS) return "amber";
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
) {
  const manilaDay = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const today = manilaDay(now);

  const summary = {
    activeJobs: 0,
    addedToday: 0,
    palayKg: 0,
    palaySacks: 0,
    riceKg: 0,
    riceSacks: 0,
    expiringSoon: 0,
    unpaidTotal: 0,
    unpaidCount: 0,
    releasedUnpaid: 0,
  };

  for (const load of loads) {
    if (load.stage !== "Stored" && load.stage !== "Released") summary.activeJobs++;
    if (manilaDay(new Date(load.created_at)) === today) summary.addedToday++;

    if (load.stage === "Stored" && isServiceType(load.service_type)) {
      if (productFor(load.service_type) === "rice") {
        summary.riceKg += load.kilos;
        summary.riceSacks += load.sacks;
      } else {
        summary.palayKg += load.kilos;
        summary.palaySacks += load.sacks;
      }
      const left = storedDaysLeft(load, now, lifeline);
      if (left !== null && left <= EXPIRY_WARNING_DAYS) summary.expiringSoon++;
    }

    if (!load.is_paid) {
      summary.unpaidTotal += load.agreed_price;
      summary.unpaidCount++;
      if (load.stage === "Released") summary.releasedUnpaid++;
    }
  }

  return summary;
}

/** What a customer should read about their job, in plain words. */
export function customerStatus(load: LoadRow): {
  label: string;
  tone: "amber" | "red" | "green" | "blue" | "gray";
} {
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
  const keepPercent = load.keep_percent ?? 100;
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
  };
  for (const load of loads) {
    if (load.request_status && load.request_status !== "accepted") continue;
    const s = settlement(load);
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
      return { ok: false, error: "For a split, keep a whole percentage from 1 to 99." };
    }
    return { ok: true, value: { disposition: "split", keep_percent: n, buyout_status: "requested" } };
  }
  return { ok: false, error: "Choose keep, sell or split." };
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
  | { ok: false; error: string };

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
    return { ok: false, error: "Customer name is required." };
  }

  const sacks = parseNumber(raw.sacks);
  if (sacks === null || !Number.isInteger(sacks) || sacks < 0) {
    return { ok: false, error: "Sacks must be a whole number of 0 or more." };
  }

  const kilos = parseNumber(raw.kilos);
  if (kilos === null || kilos < 0) {
    return { ok: false, error: "Kilos must be 0 or more." };
  }

  const service_type = String(raw.service_type ?? "");
  if (!isServiceType(service_type)) {
    return { ok: false, error: "Choose a service type." };
  }

  const agreed_price = parseNumber(raw.agreed_price);
  if (agreed_price === null || agreed_price < 0) {
    return { ok: false, error: "Agreed price must be 0 or more." };
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
    return { ok: false, error: "Amount must be 0 or more." };
  }
  return { ok: true, value: n };
}
