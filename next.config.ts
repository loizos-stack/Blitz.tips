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
      // Avatars carried over from a Telegram sign-in. next/image rejects any
      // host that isn't listed, so without this the avatar renders broken.
      { protocol: "https", hostname: "t.me" },
      // SportsDataIO doesn't host crests — it returns Wikimedia URLs. The
      // primary logos are SVG, which next/image passes through unoptimized on
      // its own, but the wordmarks include PNG thumbnails that do go through
      // the optimizer and would 400 without this entry.
      { protocol: "https", hostname: "upload.wikimedia.org" },
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
      // telegram.org serves the Login Widget loader, which in turn embeds an
      // oauth.telegram.org iframe. Both need naming: there is no frame-src
      // below other than this, so framing otherwise falls back to default-src
      // 'self' and the widget renders as an empty box with a console error.
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://va.vercel-scripts.com https://telegram.org",
      "frame-src 'self' https://oauth.telegram.org",
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

  /**
   * admin.blitz.tips is a doorway to /admin, not a second origin.
   *
   * It redirects rather than rewrites deliberately. Serving the admin app from
   * its own hostname would mean sharing the session across origins, and that
   * costs more than it sounds: the session cookie would have to widen to
   * Domain=.blitz.tips — reaching every present and future subdomain, including
   * anything later parked on a CNAME — and the CSRF cookie would have to give
   * up its `__Host-` prefix, which forbids a Domain attribute by spec. A path
   * on one origin is the stricter arrangement, so the subdomain hands you to it
   * instead of replacing it.
   *
   * Done here rather than as a Vercel domain redirect because that preserves
   * the path: admin.blitz.tips would land on blitz.tips/, not on /admin.
   *
   * The destination host is written out rather than derived from an env var. A
   * wrong or preview-shaped value would silently send admins to the wrong
   * deployment, and this is the one door where that matters.
   */
  async redirects() {
    const onAdminHost = [{ type: "host" as const, value: "admin.blitz.tips" }];
    return [
      // The bare host, kept separate so it lands on /admin in one hop rather
      // than on /admin/ and then bouncing again for the trailing slash.
      { source: "/", has: onAdminHost, destination: "https://blitz.tips/admin", permanent: false },
      // Everything else maps under /admin, so a bookmark of
      // admin.blitz.tips/handicappers still arrives somewhere sensible. Query
      // strings are carried over automatically.
      {
        source: "/:path*",
        has: onAdminHost,
        destination: "https://blitz.tips/admin/:path*",
        // Temporary (307), never permanent. A 308 is cached by browsers close
        // to forever, so if this ever becomes a real rewrite the stale redirect
        // would have to be evicted from every admin's browser one at a time.
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
