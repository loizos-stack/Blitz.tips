import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/site";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { DeferredWidgets } from "@/components/deferred-widgets";

// Inter carries body/UI text (excellent tabular figures for odds, units, ROI);
// Space Grotesk gives headings and the wordmark a sportier, confident edge.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Blitz.tips is a marketplace of verified sports handicappers. Track real records, compare units and ROI, read subscriber reviews, and subscribe to the cappers who actually win — across the NFL, NBA, MLB, NHL, and soccer.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Blitz.tips — Follow the sharpest sports handicappers",
    template: "%s — Blitz.tips",
  },
  description: DESCRIPTION,
  applicationName: "Blitz.tips",
  keywords: [
    "sports handicappers",
    "verified betting records",
    "sports betting picks",
    "sports betting tips",
    "handicapper leaderboard",
    "NFL picks",
    "NBA picks",
    "MLB picks",
    "NHL picks",
    "soccer betting tips",
    "player props",
    "parlays",
    "betting ROI",
    "sports betting marketplace",
  ],
  authors: [{ name: "Blitz.tips" }],
  creator: "Blitz.tips",
  publisher: "Blitz.tips",
  category: "Sports",
  alternates: { canonical: "/" },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <Providers>
          <RegisterServiceWorker />
          <AnnouncementBanner />
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
          <DeferredWidgets />
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
