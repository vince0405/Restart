// Error messages shown to people, looked up by a short code.
//
// Server actions redirect with ?error=<code>, never with the message
// itself. Pages turn the code back into one of these fixed sentences, so
// nobody can craft a link that paints their own text (or a phone number to
// "pay") onto a real RPS1 page, and raw database errors never reach users.

export const ERROR_MESSAGES = {
  // Form input
  name_required: "Customer name is required (up to 120 characters).",
  address_required: "Enter the farm address — where to harvest (up to 300 characters).",
  sacks_invalid: "Sacks must be a whole number of 0 or more.",
  kilos_invalid: "Kilos must be 0 or more.",
  service_invalid: "Choose a service type.",
  price_invalid: "Enter an amount of 0 or more.",
  market_price_invalid: "Enter today's market price of palay per kg (0 or more).",
  weight_invalid: "Enter the output weight in kg (0 or more).",
  reason_required: "Give the customer a reason for rejecting.",
  choice_required: "Choose keep, sell or split.",
  split_invalid: "For a split, keep a whole percentage from 1 to 99.",
  role_invalid: "Choose a role from the list.",
  name_missing: "Enter the person's full name (up to 120 characters).",
  email_invalid: "That email address doesn't look right.",
  email_taken: "That email already has an account. Find it in the list below and change its role there.",
  phone_invalid: "Enter a Philippine mobile number, like 0917 123 4567.",
  payment_too_much: "That is more than what is still owed. Check the amount.",
  payment_locked: "This job is released, so its payments can't be removed.",
  fee_locked: "The fee can't change after the job is released or paid out.",
  request_closed: "This request is closed. Nothing more can be done with it.",
  request_waiting: "Accept the request first.",
  requests_limit: "You already have 3 requests waiting. Wait for the co-op to answer, or cancel one.",
  password_current: "Your current password is not right.",
  day_booked: "That day is already booked. Please choose another day.",
  day_past: "Choose today or a later day.",
  contact_name_required: "Enter the name the co-op should ask for (up to 120 characters).",
  contact_phone_invalid: "Enter a mobile number the co-op can call, like 0917 123 4567.",
  phone_taken: "That mobile number already has an account. Find it in the list below and change its role there.",
  password_short: "The password must be at least 8 characters.",
  password_mismatch: "The two passwords don't match.",
  signup_disabled: "Sign-ups are switched off in Supabase, so accounts can't be created. Turn them back on first.",
  too_many_tries: "Too many accounts created in a short time. Wait a few minutes and try again.",
  role_failed: "The account was created as a Customer, but its role could not be set. Set it in the list below.",

  // Rules the database refused
  choose_first: "The customer must choose keep, sell or split first.",
  nothing_kept: "Nothing was kept, so there is nothing to store.",
  unpaid_release: "The customer still owes money. Record the payment first, then release.",
  not_allowed: "Your role is not allowed to do that.",
  not_changed: "Nothing changed. The job may have moved on already — refresh and try again.",
  payment_invalid: "Enter an amount above 0 and choose how it was paid.",
  payment_date_invalid: "Enter the date it was paid (today or earlier).",
  supply_invalid: "Choose rice or palay and enter an amount above 0 kg.",
  supply_too_much: "That is more than the co-op has. Check the amount.",
  dryer_full: "That dryer load is full. Choose another one or start a new load.",
  dryer_not_drying: "Only a job that is drying, with its sacks counted, can go into a dryer load.",
  service_locked: "The service can only be changed before work starts on the job.",
  cancel_closed:
    "This request can no longer be cancelled — the co-op may already be working on it, or the time to cancel has passed.",

  // Anything else
  save_failed: "Could not save. Please try again.",
  load_failed: "Could not load the data. Please refresh.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

/** The fixed message for a code from the address bar, or null if unknown. */
export function errorMessage(code: unknown): string | null {
  if (typeof code !== "string") return null;
  return code in ERROR_MESSAGES ? ERROR_MESSAGES[code as ErrorCode] : ERROR_MESSAGES.save_failed;
}

/**
 * Turn a database error into a code. The database's own words (which can
 * name columns and roles) stay on the server. No error at all means the
 * update matched no rows.
 */
export function codeForDbError(error: { message?: string } | null): ErrorCode {
  if (!error) return "not_changed";
  const m = error.message ?? "";
  if (m.includes("must choose keep, sell or split first")) return "choose_first";
  if (m.includes("Nothing was kept")) return "nothing_kept";
  if (m.includes("must pay before release")) return "unpaid_release";
  if (m.includes("can no longer be cancelled")) return "cancel_closed";
  if (m.includes("can only be changed before work starts")) return "service_locked";
  if (m.includes("dryer load is full")) return "dryer_full";
  if (m.includes("can only be recorded on accepted jobs")) return "not_allowed";
  if (m.includes("auditor can view but not change")) return "not_allowed";
  if (m.includes("day is already booked")) return "day_booked";
  if (m.includes("more than what is still owed")) return "payment_too_much";
  if (m.includes("payment on a released job")) return "payment_locked";
  if (m.includes("fee cannot change after release")) return "fee_locked";
  if (m.includes("request is closed")) return "request_closed";
  if (m.includes("Accept the request first")) return "request_waiting";
  if (m.includes("requests waiting")) return "requests_limit";
  if (m.includes("more than the co-op has")) return "supply_too_much";
  if (m.includes("Choose today or a later day")) return "day_past";
  if (m.includes("dryer load only while drying") || m.includes("before adding the job to a dryer load")) {
    return "dryer_not_drying";
  }
  if (m.includes("cannot") || m.includes("Only the") || m.includes("permission denied")) {
    return "not_allowed";
  }
  return "save_failed";
}

/** The form field an error is about, so that field can be marked invalid. */
const ERROR_FIELDS: Partial<Record<ErrorCode, string>> = {
  name_required: "customer_name",
  sacks_invalid: "sacks",
  kilos_invalid: "kilos",
  service_invalid: "service_type",
  price_invalid: "agreed_price",
  address_required: "harvest_address",
  contact_name_required: "customer_name",
  contact_phone_invalid: "contact_phone",
  day_booked: "preferred_date",
  day_past: "preferred_date",
};

/** Which field (by name) the error code in the address is about, if any. */
export function errorField(code: unknown): string | null {
  return typeof code === "string" && code in ERROR_FIELDS
    ? (ERROR_FIELDS[code as ErrorCode] ?? null)
    : null;
}

/** The id of the page's error message, for aria-describedby. */
export const FORM_ERROR_ID = "form-error";
