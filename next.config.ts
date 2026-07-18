import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js loads its wasm core + worker at runtime; keep it external so
  // Next doesn't try to bundle those assets into the serverless function.
  serverExternalPackages: ["tesseract.js", "web-push"],
  images: {
    // Serve modern formats and allow optimizing user-uploaded images (Vercel
    // Blob), Google OAuth avatars, and team-logo CDNs via next/image.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.espncdn.com" },
      { protocol: "https", hostname: "*.thesportsdb.com" },
    ],
  },
  async headers() {
    // Long-lived immutable cache for stable static brand assets in /public
    // (Next already fingerprints and immutably caches /_next/static).
    return [
      {
        source: "/:path*.(svg|png|jpg|jpeg|gif|webp|avif|ico|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
