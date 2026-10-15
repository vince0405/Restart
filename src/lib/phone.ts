// Signing in with a Philippine mobile number + password.
//
// Supabase's own phone sign-in sends an SMS code, which needs a paid SMS
// service (outside this project's stack). Instead, a mobile number is
// turned into an internal, email-shaped sign-in name that people never see:
//
//   0917 123 4567  ->  639171234567@phone.rps1.invalid
//
// ".invalid" is reserved worldwide and can never be a real address, so no
// email can ever reach a stranger. The person's real email (optional) is
// kept on their profile for contact only.

const PHONE_LOGIN_DOMAIN = "phone.rps1.invalid";

/**
 * A Philippine mobile number in one standard form, "+639171234567", or
 * null if it isn't one. Accepts 0917…, +63 917…, 63917… or 917…, with or
 * without spaces and dashes.
 */
export function normalizePhMobile(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[\s\-().]/g, "").replace(/^\+/, "");
  let national: string;
  if (/^09\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^639\d{9}$/.test(digits)) national = digits.slice(2);
  else if (/^9\d{9}$/.test(digits)) national = digits;
  else return null;
  return `+63${national}`;
}

/** The internal sign-in name for a normalized mobile number. */
export function phoneSignInEmail(normalized: string): string {
  return `${normalized.replace(/^\+/, "")}@${PHONE_LOGIN_DOMAIN}`;
}

/** Is this one of our internal phone sign-in names (not a real email)? */
export function isPhoneSignInEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${PHONE_LOGIN_DOMAIN}`);
}

/** "+639171234567" -> "0917 123 4567", for showing to people. */
export function formatPhMobile(normalized: string | null | undefined): string {
  const m = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(normalized ?? "");
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : (normalized ?? "");
}

/**
 * What someone typed in the sign-in box (a mobile number OR an email),
 * turned into the name Supabase signs in with. Null if it is neither.
 */
export function signInEmailFor(identifier: unknown): string | null {
  const text = String(identifier ?? "").trim();
  if (text.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text.toLowerCase() : null;
  const phone = normalizePhMobile(text);
  return phone ? phoneSignInEmail(phone) : null;
}

/** An optional real email from a form: "" -> null, bad -> false. */
export function parseOptionalEmail(raw: unknown): string | null | false {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && text.length <= 254 ? text : false;
}
