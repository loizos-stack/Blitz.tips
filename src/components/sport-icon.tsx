import type { PickSport } from "@prisma/client";

function Football({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-40 12 12)" fill="#8a5a34" />
      <ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-40 12 12)" fill="none" stroke="#5c3a1e" strokeWidth={1} />
      <path d="M7.3 14.7 L16.7 9.3" stroke="#f5ead9" strokeWidth={1.4} strokeLinecap="round" />
      <path
        d="M9.1 12.9 L10.6 12 M10.9 14.6 L12.4 13.7 M12.7 16.3 L14.2 15.4"
        stroke="#f5ead9"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function Basketball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#e8790c" />
      <g stroke="#3a2412" strokeWidth={1.1} fill="none">
        <path d="M2.5 12h19" />
        <path d="M12 2.5v19" />
        <path d="M5 5c2 2.5 2 11.5 0 14" />
        <path d="M19 5c-2 2.5-2 11.5 0 14" />
      </g>
    </svg>
  );
}

function Baseball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#fdfaf3" stroke="#d8cfb8" strokeWidth={1} />
      <path
        d="M6.3 6.3c2.7 2.3 2.7 9.1 0 11.4M17.7 6.3c-2.7 2.3-2.7 9.1 0 11.4"
        fill="none"
        stroke="#c0392b"
        strokeWidth={1.2}
      />
      <path
        d="M6 7.6l1.4-.4 M6.5 9.4l1.4-.4 M7 11.2l1.4-.4 M7.3 13.6l1.4.4 M7.8 15.4l1.4.4 M8.3 17.2l1.4.4"
        stroke="#c0392b"
        strokeWidth={0.7}
      />
      <path
        d="M18 7.6l-1.4-.4 M17.5 9.4l-1.4-.4 M17 11.2l-1.4-.4 M16.7 13.6l-1.4.4 M16.2 15.4l-1.4.4 M15.7 17.2l-1.4.4"
        stroke="#c0392b"
        strokeWidth={0.7}
      />
    </svg>
  );
}

function HockeyPuck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <ellipse cx="12" cy="9.5" rx="9" ry="3.6" fill="#3a3f47" />
      <path d="M3 9.5v4.5c0 2 4 3.6 9 3.6s9-1.6 9-3.6V9.5" fill="#1c1f24" stroke="#1c1f24" strokeWidth={0.5} />
      <ellipse cx="12" cy="9.5" rx="9" ry="3.6" fill="#2b2f36" />
    </svg>
  );
}

// Classic black-and-white soccer ball: a central pentagon, five surrounding
// pentagons and connecting seams. Bold outline so it reads on the light theme.
function SoccerBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#ffffff" stroke="#2b2f36" strokeWidth={1.2} />
      <path d="M12 7.9l3.3 2.4-1.26 3.9H9.96L8.7 10.3z" fill="#20242c" />
      <g fill="#20242c">
        <path d="M12 2.7l1.9 1.4-.7 2.1h-2.4l-.7-2.1z" />
        <path d="M3.5 8.9l2.2-.1.75 2.15-1.8 1.35-1.75-1.3z" />
        <path d="M20.5 8.9l-2.2-.1-.75 2.15 1.8 1.35 1.75-1.3z" />
        <path d="M7.2 19.9l.7-2.15 2.25.75.15 2.25-2.15.6z" />
        <path d="M16.8 19.9l-.7-2.15-2.25.75-.15 2.25 2.15.6z" />
      </g>
      <g stroke="#2b2f36" strokeWidth={1.1} fill="none" strokeLinecap="round">
        <path d="M12 7.9V6" />
        <path d="M8.85 10.6L6.2 9.9" />
        <path d="M15.15 10.6l2.65-.7" />
        <path d="M10.05 14.2l-1.6 1.9" />
        <path d="M13.95 14.2l1.6 1.9" />
      </g>
    </svg>
  );
}

// Flag in the cup on a green — reads as golf even at 14px.
function GolfFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <ellipse cx="12" cy="19" rx="8.5" ry="3" fill="#4caf50" />
      <path d="M10.5 4.5v13" stroke="#6b7280" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M10.5 4l7 2.3-7 2.4z" fill="#e53935" />
      <circle cx="15.8" cy="18.2" r="1.7" fill="#ffffff" stroke="#c4c8cd" strokeWidth={0.7} />
    </svg>
  );
}

// Optic-yellow ball with white seams.
function TennisBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#cddc39" stroke="#9eb020" strokeWidth={0.8} />
      <path
        d="M4.4 6.4c3.7 1.8 3.7 9.4 0 11.2M19.6 6.4c-3.7 1.8-3.7 9.4 0 11.2"
        stroke="#fdfdf5"
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Gold trophy — the catch-all for "Other" and anything without its own mark.
function Trophy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M7 3.5h10V9a5 5 0 0 1-10 0V3.5z" fill="#eab308" stroke="#a16207" strokeWidth={0.8} />
      <path
        d="M7 4.8H4.2c.1 3 1.4 4.7 3.3 5.1M17 4.8h2.8c-.1 3-1.4 4.7-3.3 5.1"
        stroke="#a16207"
        strokeWidth={1.3}
        fill="none"
      />
      <path d="M10.9 13.7h2.2v3h-2.2z" fill="#a16207" />
      <path d="M8.3 16.7h7.4c.4 0 .8.34.8.75v1.55H7.5v-1.55c0-.41.36-.75.8-.75z" fill="#854d0e" />
    </svg>
  );
}

// Red boxing glove — the striking-sports mark for UFC / MMA.
function BoxingGlove({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M6.2 11.9c-1.7.05-3-1-3-2.35 0-1.3 1.2-2.35 2.8-2.3z" fill="#d92d2d" />
      <path
        d="M6 8.3C6 5.7 8.1 3.7 10.7 3.7h1.7C15.6 3.7 18 6 18 8.9v3.5c0 1.9-1.5 3.4-3.4 3.4H9.4C7.5 15.8 6 14.3 6 12.4z"
        fill="#e63946"
      />
      <path d="M9.1 8.3c1.9-.7 3.9-.7 5.8 0" stroke="#a52020" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <path
        d="M8.7 15.8h6c.85 0 1.5.65 1.5 1.5v1.7c0 .85-.65 1.5-1.5 1.5H9c-.85 0-1.5-.65-1.5-1.5v-1.5c0-.95.55-1.7 1.2-1.7z"
        fill="#c92a2a"
      />
      <path d="M7.9 18.2h8.2" stroke="#8f1c1c" strokeWidth={0.9} />
    </svg>
  );
}

const ICONS: Partial<Record<PickSport, React.ComponentType<{ className?: string }>>> = {
  NFL: Football,
  NCAAF: Football,
  NBA: Basketball,
  WNBA: Basketball,
  NCAAB: Basketball,
  MLB: Baseball,
  NHL: HockeyPuck,
  SOCCER: SoccerBall,
  UFC_MMA: BoxingGlove,
  GOLF: GolfFlag,
  TENNIS: TennisBall,
  OTHER: Trophy,
};

export function SportIcon({ sport, className }: { sport: PickSport; className?: string }) {
  const Icon = ICONS[sport] ?? Trophy;
  return <Icon className={className} />;
}
