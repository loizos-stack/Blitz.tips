"use client";

import { useState } from "react";
import { CreatePickForm } from "@/components/create-pick-form";
import { CreateParlayForm } from "@/components/create-parlay-form";

// Coordinates the single-tip and parlay posting forms so only one is open at a
// time — opening either collapses the other.
export function PostTipForms({ handicapperSports }: { handicapperSports: string[] }) {
  const [active, setActive] = useState<"pick" | "parlay" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <CreatePickForm
        handicapperSports={handicapperSports}
        open={active === "pick"}
        onOpenChange={(open) => setActive(open ? "pick" : null)}
      />
      <CreateParlayForm
        handicapperSports={handicapperSports}
        open={active === "parlay"}
        onOpenChange={(open) => setActive(open ? "parlay" : null)}
      />
    </div>
  );
}
