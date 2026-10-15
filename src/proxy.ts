import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * The Content-Security-Policy (Ticket 44): the browser's list of what a
 * page may load. Scripts run only with this request's one-time nonce, so
 * even an injected script tag would be refused. Styles allow inline
 * `style=` (the charts and bars use them). Data only comes from this site
 * and our Supabase project. Nobody may frame the app or post its forms
 * elsewhere.
 */
function contentSecurityPolicy(nonce: string, https: boolean) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabase.replace(/^https/, "wss")}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Runs before every page request. Its main job is to keep each person's
 * login fresh: Supabase login tokens expire after a while, and this swaps
 * an expiring one for a new one and saves it in the browser's cookies. It
 * also sets the Content-Security-Policy with a fresh nonce.
 *
 * It does NOT decide who may see what. Each page checks that itself, and
 * Row Level Security checks it again in the database. The one thing it
 * routes: a signed-out visit to "/" shows the public landing page.
 */
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, request.nextUrl.protocol === "https:");

  // Next.js reads the nonce from the request's CSP header and puts it on
  // its own scripts; the root layout reads x-nonce for the theme script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Pass the refreshed login on to the page in this same request.
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = next();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Asking for the user is what triggers the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-out visitors to the home address see the public landing page
  // (Ticket 43); the address stays "/". Signed-in people get their dashboard.
  if (!user && request.nextUrl.pathname === "/") {
    const landing = request.nextUrl.clone();
    landing.pathname = "/welcome";
    const rewrite = NextResponse.rewrite(landing, { request: { headers: requestHeaders } });
    response.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
    response = rewrite;
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip Next.js internals and static files (the logo and icons too).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
