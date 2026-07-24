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
    // Sitewide security headers. The CSP allows the app's own inline scripts
    // (Next's hydration bootstrap + the gtag config), Google Analytics, and
    // Vercel's first-party analytics; it locks down framing, plugins, and the
    // document base URI. img-src stays broad because team-logo crests load from
    // many sports CDNs.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://va.vercel-scripts.com",
      "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.vercel-insights.com https://va.vercel-scripts.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];

    return [
      { source: "/:path*", headers: securityHeaders },
      // Long-lived immutable cache for stable static brand assets in /public
      // (Next already fingerprints and immutably caches /_next/static).
      {
        source: "/:path*.(svg|png|jpg|jpeg|gif|webp|avif|ico|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
