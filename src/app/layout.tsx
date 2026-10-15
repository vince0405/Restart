import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// next/font downloads Inter once at build time and serves it from our own
// site, so phones never wait on Google Fonts.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "RPS1 · Rice Processing",
  description: "Track every palay load from intake to payment",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1410" },
  ],
};

// Runs before the page is drawn, so dark mode never flashes white first.
// It reads the saved choice ("light" / "dark"), otherwise follows the phone.
// A fixed string we wrote — no user input — so inlining it is safe.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("rps1-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script above may add "dark" before React
    // loads, which is expected.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
