import type { MetadataRoute } from "next";

// Web app manifest — makes Blitz.tips installable to the home screen on
// Android and iOS (Add to Home Screen), where it launches standalone and web
// push notifications work.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blitz.tips",
    short_name: "Blitz.tips",
    description: "Follow verified sports handicappers — track records, units, ROI, and get picks the moment they drop.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#16a34a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
