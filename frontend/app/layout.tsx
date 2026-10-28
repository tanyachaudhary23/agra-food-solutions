import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./globals.css";
import Script from "next/script";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Spare Parts for Roller Flour Mills & Grain Milling`, template: `%s | ${site.shortName}` },
  description: site.description,
  openGraph: { type: "website", siteName: site.name, title: site.name, description: site.description, url: site.url },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="js-flag" strategy="beforeInteractive">{"document.documentElement.classList.add('js')"}</Script>
        {children}
      </body>
    </html>
  );
}
