// The fixed vocabulary of the app, in one place so the form, the detail
// screen and the database all agree.

export const SERVICE_TYPES = [
  "Package Deal",
  "Drying only",
  "Milling only",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

// A load moves through these stages in order, forward or one back.
export const STAGES = [
  "Received",
  "Drying",
  "Dried",
  "Milling",
  "Milled",
  "Released",
] as const;

export type Stage = (typeof STAGES)[number];

export function isServiceType(value: string): value is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

/** The stage after this one, or null if this is the last (Released). */
export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

/** The stage before this one, or null if this is the first (Received). */
export function prevStage(stage: Stage): Stage | null {
  const i = STAGES.indexOf(stage);
  return i > 0 ? STAGES[i - 1] : null;
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
