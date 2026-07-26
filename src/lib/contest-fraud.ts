import "server-only";
import { prisma } from "@/lib/prisma";

export interface SharedIpCluster {
  ip: string;
  entries: { entryId: string; userId: string; name: string; hits: number }[];
}

export interface ContestFraudReport {
  // IPs used by 2+ distinct entries — the core multi-account / collusion signal.
  sharedIps: SharedIpCluster[];
  // Entry IDs implicated in at least one shared IP.
  flaggedEntryIds: Set<string>;
  // entryId -> how many OTHER entries it shares an IP with.
  sharedPeersByEntry: Map<string, number>;
}

/**
 * Build a fraud report for a contest from its IP/device signal log. The primary
 * signal is a single IP address used by more than one entry (duplicate people /
 * a single person running multiple accounts, or colluders on one network).
 */
export async function contestFraudReport(
  contestId: string,
  entryNames: Map<string, string>
): Promise<ContestFraudReport> {
  const logs = await prisma.contestIpLog.findMany({
    where: { contestId },
    select: { ip: true, entryId: true, userId: true },
  });

  // ip -> (entryId -> { userId, hits })
  const byIp = new Map<string, Map<string, { userId: string; hits: number }>>();
  for (const l of logs) {
    let m = byIp.get(l.ip);
    if (!m) {
      m = new Map();
      byIp.set(l.ip, m);
    }
    const cur = m.get(l.entryId);
    if (cur) cur.hits += 1;
    else m.set(l.entryId, { userId: l.userId, hits: 1 });
  }

  const sharedIps: SharedIpCluster[] = [];
  const flaggedEntryIds = new Set<string>();

  for (const [ip, m] of byIp) {
    if (m.size < 2) continue; // used by a single entry — not shared
    const entries = [...m.entries()].map(([entryId, v]) => ({
      entryId,
      userId: v.userId,
      name: entryNames.get(entryId) ?? "Entrant",
      hits: v.hits,
    }));
    sharedIps.push({ ip, entries });
    for (const e of entries) flaggedEntryIds.add(e.entryId);
  }

  // For each flagged entry, count the distinct OTHER entries it shares any IP with.
  const sharedPeersByEntry = new Map<string, number>();
  for (const entryId of flaggedEntryIds) {
    const peers = new Set<string>();
    for (const cluster of sharedIps) {
      if (cluster.entries.some((e) => e.entryId === entryId)) {
        for (const e of cluster.entries) if (e.entryId !== entryId) peers.add(e.entryId);
      }
    }
    sharedPeersByEntry.set(entryId, peers.size);
  }

  sharedIps.sort((a, b) => b.entries.length - a.entries.length);
  return { sharedIps, flaggedEntryIds, sharedPeersByEntry };
}
