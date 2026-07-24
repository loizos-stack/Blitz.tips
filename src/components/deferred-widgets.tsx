"use client";

import dynamic from "next/dynamic";

// Non-critical, below-the-fold client widgets. Loading them with ssr:false keeps
// their JavaScript out of the initial bundle and off the main thread during the
// first paint/hydration — a Total Blocking Time win on mobile. They mount a
// moment after the page is interactive.
const ChatWidget = dynamic(() => import("@/components/chat/chat-widget").then((m) => m.ChatWidget), {
  ssr: false,
});
const InstallPrompt = dynamic(() => import("@/components/install-prompt").then((m) => m.InstallPrompt), {
  ssr: false,
});

export function DeferredWidgets() {
  return (
    <>
      <InstallPrompt />
      <ChatWidget />
    </>
  );
}
