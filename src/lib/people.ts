// Searching the People list (Ticket 37). Kept free of Next.js and Supabase
// so it can be unit-tested.

/**
 * Does this person match the search? By name (any case, any part), or by
 * mobile number however it is typed: "0917 123", "+63 917", "917-123".
 * Numbers are stored as +639171234567.
 */
export function matchesPerson(person: { full_name: string; phone: string }, q: string): boolean {
  const text = q.trim().toLowerCase();
  if (!text) return true;
  if (person.full_name.toLowerCase().includes(text)) return true;

  const digits = text.replace(/\D/g, "");
  if (digits.length < 3) return false;
  // Compare without the country code or leading 0: 0917… / 63917… -> 917…
  const typed = digits.replace(/^63/, "").replace(/^0/, "");
  const stored = person.phone.replace(/\D/g, "").replace(/^63/, "");
  return typed.length > 0 && stored.includes(typed);
}
