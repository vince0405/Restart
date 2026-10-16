// The one password rule for RPS1, checked on the server by every form that
// sets a password: sign-up, reset, change, and the starting password a
// Chairperson or admin gives someone. Supabase checks the same minimum
// (Authentication -> Providers -> Email), so the two always agree.
//
// Mobile numbers are easy to guess, so the password is the only real lock:
// no all-number or all-letter passwords, no well-known ones, and not the
// person's own mobile number.

/** What people are told, under each password box and in the error. */
export const PASSWORD_RULE = "At least 8 characters, with both letters and numbers.";

// Passwords attackers try first. Compared after lowercasing, so
// "Password1" counts as "password1".
const COMMON = new Set([
  "password1", "password12", "password123", "passw0rd", "p4ssw0rd", "pa55word",
  "abc12345", "abcd1234", "abc123456", "a1b2c3d4", "1q2w3e4r", "q1w2e3r4",
  "qwerty12", "qwerty123", "qwe12345", "asdf1234", "zxcv1234", "1qaz2wsx",
  "iloveyou1", "iloveyou2", "welcome1", "welcome123", "admin123", "admin1234",
  "letmein1", "trustno1", "monkey123", "dragon123", "test1234", "user1234",
  "rps12345", "rps1rps1", "palay123", "rice1234", "coop1234", "farmer123",
  "philippines1", "pilipinas1", "mahalkita1", "iloveu123", "123456abc", "12345abc",
]);

/**
 * Why a password is not good enough, or null if it is fine. `phone` is the
 * person's mobile number (+639…), when the form knows it.
 */
export function passwordProblem(password: string, phone?: string | null): string | null {
  if (password.length < 8) return "too short";
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return "needs letters and numbers";
  if (COMMON.has(password.toLowerCase())) return "too common";
  // The last 10 digits of +639171234567 are 9171234567.
  const digits = phone?.replace(/\D/g, "").slice(-10);
  if (digits && password.replace(/\D/g, "").includes(digits)) return "contains the mobile number";
  return null;
}
