import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/site";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { getCachedAnnouncement } from "@/lib/settings";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { DeferredWidgets } from "@/components/deferred-widgets";
import { SitePopups } from "@/components/site-popups";
import { AnalyticsGate } from "@/components/analytics-gate";
import { needsCookieConsent } from "@/lib/geo";

// Space Grotesk is the single web font — body/UI text and the sportier headings
// and wordmark. (Monospace bits use the system mono stack; see globals.css.)
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

// Google truncates a search snippet around 155-160 characters. The old copy ran
// to 222 and was cut mid-sentence in the SERP, so the call to action never
// showed. Keep any replacement under ~155 and put the offer in the first half.
const DESCRIPTION =
  "Verified sports handicappers with real, timestamped records. Compare units and ROI across NFL, NBA, MLB, NHL and soccer, then subscribe.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    // Leads with what people actually search for rather than with brand voice:
    // "sports handicappers" and "betting picks" are the queries, "follow the
    // sharpest" is a slogan nobody types.
    default: "Verified Sports Handicappers & Betting Picks — Blitz.tips",
    template: "%s — Blitz.tips",
  },
  description: DESCRIPTION,
  applicationName: "Blitz.tips",
  authors: [{ name: "Blitz.tips" }],
  creator: "Blitz.tips",
  publisher: "Blitz.tips",
  category: "Sports",
  // No `alternates.canonical` here on purpose. Metadata is inherited, so a
  // canonical set on the root layout becomes every page's canonical unless that
  // page overrides it — which told Google that /about, /buy-picks and the rest
  // were duplicates of the homepage, and Search Console duly filed them under
  // "Alternate page with proper canonical tag" and left them out of the index.
  // Each page declares its own; the homepage's lives in app/page.tsx.
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    siteName: "Blitz.tips",
    title: "Blitz.tips — Follow the sharpest sports handicappers",
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blitz.tips — Follow the sharpest sports handicappers",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Installed-app presentation on iOS (Add to Home Screen → standalone).
  appleWebApp: { capable: true, title: "Blitz.tips", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const announcement = await getCachedAnnouncement();
  // Resolved once and shared: the prompt and the analytics gate must agree on
  // whether this visitor needs consent, or one will contradict the other.
  const consentRequired = await needsCookieConsent();
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <Providers>
          <RegisterServiceWorker />
          <AnnouncementBanner initialMessage={announcement} />
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
          <DeferredWidgets />
          <SitePopups cookieConsentRequired={consentRequired} />
        </Providers>
        {/* Cookieless and device-storage-free, so these sit outside the consent
            gate — blocking them would cost the site its traffic numbers without
            any compliance gain. */}
        <SpeedInsights />
        <Analytics />
        {/* Google Analytics writes cookies, so it only loads once consent
            allows it. */}
        <AnalyticsGate consentRequired={consentRequired} />
      </body>
    </html>
  );
}
