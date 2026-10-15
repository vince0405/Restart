import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't announce the framework in every response (Ticket 44).
  poweredByHeader: false,
  // Cache Components and Partial Prefetching are deliberately OFF.
  //
  // With them on, any page that reads from the database (or uses
  // cookies, headers or searchParams) fails the build unless it is
  // wrapped in <Suspense> or marked with "use cache". That is a fine
  // trade for a production team tuning performance; for a team writing
  // its first database query it is an opaque build error at exactly
  // the wrong moment.
  //
  // Turn them back on later if you want them, and read:
  // https://nextjs.org/docs/messages/blocking-prerender-dynamic
  // Basic browser security headers on every page (Ticket 37):
  // - no showing RPS1 inside another site's frame (stops "clickjacking")
  // - no guessing file types (stops a file being run as a script)
  // - only our own address is shared when someone follows a link out
  // - no camera, microphone or location: the app does not use them
  // The Content-Security-Policy is set per request in src/proxy.ts (it
  // needs a fresh nonce each time).
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Pages opened from RPS1 can't reach back into it (Ticket 44).
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
