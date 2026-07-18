import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js loads its wasm core + worker at runtime; keep it external so
  // Next doesn't try to bundle those assets into the serverless function.
  serverExternalPackages: ["tesseract.js", "web-push"],
  images: {
    // Serve modern formats and allow optimizing user-uploaded images (Vercel
    // Blob) and Google OAuth avatars via next/image.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
