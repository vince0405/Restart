import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where links in Supabase's emails land (Ticket 36: password reset). It
 * swaps the one-time code in the link for a short sign-in, then goes on to
 * `next` — only ever a page on this site, never another website.
 *
 * Two link styles are accepted:
 * - ?code=…               Supabase's default email (works in the same browser
 *                         that asked for the link)
 * - ?token_hash=…&type=…  if the email template is changed to use
 *                         {{ .TokenHash }} (works on any device)
 */
/** Only these pages may follow an email link (Ticket 42: no open redirect). */
const NEXT_PAGES = ["/reset-password", "/"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  // An exact page from the list, never a path to build an address from:
  // tricks like "/\evil.com" or a hidden tab would otherwise leave the site.
  const rawNext = searchParams.get("next") ?? "/";
  const next = NEXT_PAGES.includes(rawNext) ? rawNext : "/";

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  // Only password-reset links are used by RPS1.
  const type: EmailOtpType | null = searchParams.get("type") === "recovery" ? "recovery" : null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/forgot?expired=1", origin));
}
