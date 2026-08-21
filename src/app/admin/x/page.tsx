import { readdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { getConnectedAccount, xConfigured } from "@/lib/x-api";
import { XManager } from "@/components/admin/x-manager";

export const dynamic = "force-dynamic";

export default async function AdminXPage() {
  await guardAdminPage("x");

  // Stills and video both. X accepts jpg too, unlike the Telegram tool, so the
  // filter is wider than that page's.
  const assets = await readdir(join(process.cwd(), "public/marketing"))
    .then((files) => files.filter((f) => /\.(png|jpe?g|mp4)$/i.test(f)).sort())
    .catch(() => [] as string[]);

  const [account, posts] = await Promise.all([
    getConnectedAccount(),
    prisma.xPost.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  return (
    <XManager
      configured={xConfigured()}
      assets={assets}
      account={
        account && {
          username: account.username,
          name: account.name,
          scopes: account.scopes,
          connectedAt: account.connectedAt.toISOString(),
          expiresAt: account.expiresAt.toISOString(),
        }
      }
      posts={posts.map((p) => ({
        id: p.id,
        username: p.username,
        text: p.text,
        asset: p.asset,
        tweetId: p.tweetId,
        ok: p.ok,
        error: p.error,
        source: p.source,
        sentByEmail: p.sentByEmail,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
