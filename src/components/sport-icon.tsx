import { Dumbbell } from "lucide-react";
import type { PickSport } from "@prisma/client";

function Football({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-40 12 12)" />
      <path d="M7.5 14.5 L16.5 9.5" strokeLinecap="round" />
      <path d="M9.3 12.7 L10.8 11.8 M11.1 14.5 L12.6 13.6 M12.9 16.3 L14.4 15.4" strokeLinecap="round" />
    </svg>
  );
}

function Basketball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" strokeLinecap="round" />
      <path d="M5.5 5.5c2 2.5 2 10.5 0 13M18.5 5.5c-2 2.5-2 10.5 0 13" strokeLinecap="round" />
    </svg>
  );
}

function Baseball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 6.5c2.5 2 2.5 9 0 11M18 6.5c-2.5 2-2.5 9 0 11" strokeLinecap="round" />
    </svg>
  );
}

function HockeyPuck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <ellipse cx="12" cy="13" rx="9" ry="4" />
      <path d="M3 13v3c0 2.2 4 4 9 4s9-1.8 9-4v-3" />
    </svg>
  );
}

function SoccerBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l3.5 2.5-1.3 4.1H9.8L8.5 9.5 12 7z" strokeLinejoin="round" />
      <path d="M12 3.2V7M4.5 8.5l3.9 1.1M6 19l3.8-4.4M18 19l-3.8-4.4M19.5 8.5l-3.9 1.1" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Partial<Record<PickSport, React.ComponentType<{ className?: string }>>> = {
  NFL: Football,
  NCAAF: Football,
  NBA: Basketball,
  NCAAB: Basketball,
  MLB: Baseball,
  NHL: HockeyPuck,
  SOCCER: SoccerBall,
  UFC_MMA: Dumbbell,
};

export function SportIcon({ sport, className }: { sport: PickSport; className?: string }) {
  const Icon = ICONS[sport] ?? Football;
  return <Icon className={className} />;
}
