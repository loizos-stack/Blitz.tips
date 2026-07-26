import { socialLinksFor, type SocialField } from "@/lib/socials";
import { SocialIcon } from "@/components/social-icon";
import type { HandicapperProfile } from "@prisma/client";

// Renders a handicapper's social links as icons. `linked` controls whether each
// icon is a real anchor (profile page) or a static glyph (inside a card, which
// is itself a link — nesting anchors would be invalid).
export function SocialLinks({
  profile,
  linked = true,
  iconClassName = "h-4 w-4",
  className = "",
}: {
  profile: Pick<HandicapperProfile, SocialField>;
  linked?: boolean;
  iconClassName?: string;
  className?: string;
}) {
  const links = socialLinksFor(profile);
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map((link) =>
        linked ? (
          <a
            key={link.key}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={link.label}
            title={link.label}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <SocialIcon platform={link.key} className={iconClassName} />
          </a>
        ) : (
          <span
            key={link.key}
            aria-label={link.label}
            title={link.label}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-raised text-muted"
          >
            <SocialIcon platform={link.key} className="h-3.5 w-3.5" />
          </span>
        )
      )}
    </div>
  );
}
