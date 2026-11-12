import { notFound } from "next/navigation";
import { supercapperVisible } from "@/lib/supercapper-visibility";

/**
 * One gate in front of every Supercapper page.
 *
 * A layout rather than a check repeated in each page: /supercapper has seven
 * routes and would grow more, and a hidden section that forgets one of them is
 * worse than no gate at all — the forgotten page is the one a search engine
 * still has indexed.
 *
 * notFound() rather than a redirect, because while the contest is postponed
 * the page genuinely isn't there; a redirect to the home page would tell a
 * crawler the contest URL has permanently moved, which would have to be undone
 * when it comes back.
 */
export default function SupercapperLayout({ children }: { children: React.ReactNode }) {
  if (!supercapperVisible()) notFound();
  return <>{children}</>;
}
