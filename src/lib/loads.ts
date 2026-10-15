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

/** How long stored grain keeps: palay 3 months, rice 1 month. */
export const SHELF_LIFE_MONTHS = { palay: 3, rice: 1 } as const;

/**
 * The date stored grain goes bad. Calendar months, so 31 January plus one
 * month is 28 (or 29) February, not 3 March.
 */
export function expiryDate(storedAt: Date, service: ServiceType): Date {
  const months = SHELF_LIFE_MONTHS[productFor(service)];
  const d = new Date(storedAt);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Whole days from now until the expiry date. Negative once expired. */
export function daysLeft(expiry: Date, now: Date = new Date()): number {
  return Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
}

/** Warn when this many days or fewer are left. */
export const EXPIRY_WARNING_DAYS = 7;

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
