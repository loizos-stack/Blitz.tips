import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js loads its wasm core + worker at runtime; keep it external so
  // Next doesn't try to bundle those assets into the serverless function.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
