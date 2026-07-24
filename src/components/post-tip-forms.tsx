"use client";

import { useState } from "react";
import { CreatePickForm } from "@/components/create-pick-form";
import { CreateParlayForm } from "@/components/create-parlay-form";
import { FirstPostNotice } from "@/components/first-post-notice";

const ACK_KEY = "blitz_first_post_ack";

// Coordinates the single-tip and parlay posting forms so only one is open at a
// time — opening either collapses the other. Before a handicapper's first-ever
// post, opening a form first surfaces a one-time "double-check" notice they must
// acknowledge.
export function PostTipForms({
  handicapperSports,
  hasPosted,
}: {
  handicapperSports: string[];
  /** True once the handicapper has at least one pick — skips the first-post notice. */
  hasPosted: boolean;
}) {
  const [active, setActive] = useState<"pick" | "parlay" | null>(null);
  // Which form the handicapper is trying to open while the notice is up.
  const [pending, setPending] = useState<"pick" | "parlay" | null>(null);

  function alreadyAcknowledged() {
    if (hasPosted) return true;
    try {
      return localStorage.getItem(ACK_KEY) === "1";
    } catch {
      return false;
    }
  }

  function requestOpen(which: "pick" | "parlay", open: boolean) {
    if (!open) {
      setActive(null);
      return;
    }
    if (!alreadyAcknowledged()) {
      setPending(which);
      return;
    }
    setActive(which);
  }

  function confirmNotice() {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {
      // Ignore storage failures — worst case the notice shows again next time.
    }
    setActive(pending);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <CreatePickForm
        open={active === "pick"}
        onOpenChange={(open) => requestOpen("pick", open)}
      />
      <CreateParlayForm
        handicapperSports={handicapperSports}
        open={active === "parlay"}
        onOpenChange={(open) => requestOpen("parlay", open)}
      />

      {pending && (
        <FirstPostNotice onConfirm={confirmNotice} onCancel={() => setPending(null)} />
      )}
    </div>
  );
}
