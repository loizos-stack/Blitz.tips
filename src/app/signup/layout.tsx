import type { Metadata } from "next";

// A sign-up form has nothing to index, and it's linked from every page — so
// without this it gets crawled and, before the root layout stopped leaking its
// canonical, was reported to Google as a duplicate of the homepage. It stays
// crawlable (not robots.txt-disallowed) so the noindex is actually seen.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
