import type { Metadata } from "next";
import { listHandicapperSummaries, sortFeaturedFirst } from "@/lib/handicappers";
import { HandicapperCard } from "@/components/handicapper-card";

export const metadata: Metadata = { title: "Handicappers" };
export const dynamic = "force-dynamic";

export default async function HandicappersPage() {
  const handicappers = await listHandicapperSummaries();
  const sorted = sortFeaturedFirst(handicappers, (a, b) => b.stats.unitsNet - a.stats.unitsNet);

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Handicappers</h1>
      <p className="mt-2 text-muted">Browse every capper on Blitz.tips and their public track record.</p>

      {sorted.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">No handicappers have joined yet.</div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((h) => (
            <HandicapperCard key={h.id} handicapper={h} />
          ))}
        </div>
      )}
    </div>
  );
}
