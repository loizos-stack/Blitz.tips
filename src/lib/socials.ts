import type { HandicapperProfile } from "@prisma/client";

export type SocialKey = "x" | "instagram" | "youtube" | "tiktok" | "discord" | "telegram" | "website";

export type SocialField =
  | "xUrl"
  | "instagramUrl"
  | "youtubeUrl"
  | "tiktokUrl"
  | "discordUrl"
  | "telegramUrl"
  | "websiteUrl";

export interface SocialPlatform {
  key: SocialKey;
  field: SocialField;
  label: string;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: "x", field: "xUrl", label: "X (Twitter)", placeholder: "https://x.com/yourhandle" },
  { key: "instagram", field: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/yourhandle" },
  { key: "youtube", field: "youtubeUrl", label: "YouTube", placeholder: "https://youtube.com/@yourchannel" },
  { key: "tiktok", field: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle" },
  { key: "discord", field: "discordUrl", label: "Discord", placeholder: "https://discord.gg/yourinvite" },
  { key: "telegram", field: "telegramUrl", label: "Telegram", placeholder: "https://t.me/yourchannel" },
  { key: "website", field: "websiteUrl", label: "Website", placeholder: "https://yoursite.com" },
];

export interface SocialLink {
  key: SocialKey;
  label: string;
  url: string;
}

/** The non-empty social links on a profile, in display order. */
export function socialLinksFor(profile: Pick<HandicapperProfile, SocialField>): SocialLink[] {
  return SOCIAL_PLATFORMS.flatMap((p) => {
    const url = profile[p.field];
    return url ? [{ key: p.key, label: p.label, url }] : [];
  });
}

/**
 * Normalize a user-entered social URL: trims, adds https:// if missing, and
 * validates it's an http(s) URL. Returns null for blank input, throws on junk.
 */
export function normalizeSocialUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    throw new Error(`"${input}" isn't a valid link`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`"${input}" isn't a valid link`);
  }
  if (!url.hostname.includes(".")) {
    throw new Error(`"${input}" isn't a valid link`);
  }
  return url.toString();
}
