import type { Metadata } from "next";
import { ForgotPasswordClient } from "./forgot-password-client";

// Same reasoning as the sign-in page: nothing to index, linked from a page that
// is on every route, and a duplicate-content risk if crawled. Left crawlable so
// the noindex is actually seen.
export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <ForgotPasswordClient />
    </div>
  );
}
