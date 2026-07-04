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

// Classic pentagon ball with a bold outline so it doesn't wash out on the
// light theme.
function SoccerBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#f2f3f5" stroke="#79808b" strokeWidth={1.2} />
      <path d="M12 7.6l3.8 2.8-1.5 4.4H9.7l-1.5-4.4L12 7.6z" fill="#1f2430" />
      <g stroke="#1f2430" strokeWidth={1.4} strokeLinecap="round" fill="none">
        <path d="M12 2.8v4.8" />
        <path d="M3.6 9.2l4.9 1.2" />
        <path d="M6.4 19.2l3.3-4.4" />
        <path d="M17.6 19.2l-3.3-4.4" />
        <path d="M20.4 9.2l-4.9 1.2" />
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

// Octagon cage — an unmistakable MMA mark, distinct from a boxing glove.
function Octagon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" fill="#b91c1c" />
      <path
        d="M9.4 6.4h5.2L17.6 9.4v5.2L14.6 17.6H9.4L6.4 14.6V9.4z"
        fill="none"
        stroke="#fee2e2"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
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
  UFC_MMA: Octagon,
  GOLF: GolfFlag,
  TENNIS: TennisBall,
  OTHER: Trophy,
};

export function SportIcon({ sport, className }: { sport: PickSport; className?: string }) {
  const Icon = ICONS[sport] ?? Trophy;
  return <Icon className={className} />;
}
