import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { InstallPrompt } from "@/components/install-prompt";

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

export const metadata: Metadata = {
  title: {
    default: "Blitz.tips — Follow the sharpest sports handicappers",
    template: "%s — Blitz.tips",
  },
  description:
    "Blitz.tips is a marketplace of verified sports handicappers. Track real records, compare units and ROI, and subscribe to the cappers who actually win.",
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
        <Providers>
          <RegisterServiceWorker />
          <AnnouncementBanner />
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
