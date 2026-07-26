import "server-only";
import { isOutsideUs } from "@/lib/geo";
import { STAKE_ALL_REGIONS } from "@/lib/stake";

/**
 * Whether to render the Stake affiliate links for this request.
 *
 * One place decides, so the day a US sportsbook affiliate comes through it's a
 * single constant to flip (STAKE_ALL_REGIONS in lib/stake) and the geo gate
 * resumes — no hunting through call sites. Kept out of lib/stake itself because
 * that module is imported by client components and this reads request headers.
 */
export async function showStakeLinks(): Promise<boolean> {
  if (STAKE_ALL_REGIONS) return true;
  return isOutsideUs();
}
