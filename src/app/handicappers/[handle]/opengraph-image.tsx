import { ImageResponse } from "next/og";
import { getHandicapperByHandle } from "@/lib/handicappers";
import { SPORT_LABELS } from "@/lib/utils";
import { recordCard, SHARE_CARD_SIZE } from "@/lib/share-cards";

// A handicapper's verified-record card, doubling as the profile's social-share
// image — so every time a capper posts their profile link, the preview *is*
// their verified record. Also downloadable/previewed from the dashboard Share
// tab (fetched at /handicappers/<handle>/opengraph-image).
export const alt = "Verified record on Blitz.tips";
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const handicapper = await getHandicapperByHandle(handle);

  if (!handicapper) {
    return new ImageResponse(
      recordCard({
        displayName: "Blitz.tips",
        handle: "blitz",
        record: "—",
        unitsNet: 0,
        roi: null,
        winRate: null,
        totalPicks: 0,
        sports: [],
      }),
      size
    );
  }

  return new ImageResponse(
    recordCard({
      displayName: handicapper.displayName,
      handle: handicapper.handle,
      record: handicapper.stats.record,
      unitsNet: handicapper.stats.unitsNet,
      roi: handicapper.stats.roi,
      winRate: handicapper.stats.winRate,
      totalPicks: handicapper.stats.totalPicks,
      sports: handicapper.sports.map((s) => SPORT_LABELS[s] ?? s),
    }),
    size
  );
}
