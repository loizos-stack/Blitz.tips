import "server-only";
import { prisma } from "@/lib/prisma";

// One row of the raw IP/device log, flattened for the admin view.
export interface IntegrityLogRow {
  id: string;
  createdAt: string;
  action: string; // "join" | "pick"
  ip: string;
  userAgent: string | null;
  entryId: string;
  entrantName: string;
  contestName: string;
  contestSlug: string;
  disqualified: boolean;
}

// An IP address used by two or more distinct entries — the core duplicate-person
// / collusion signal, aggregated across every contest.
export interface IntegritySharedIp {
  ip: string;
  lastSeen: string;
  entries: {
    entryId: string;
    name: string;
    contestName: string;
    hits: number;
    disqualified: boolean;
  }[];
}

export interface IntegrityOverview {
  totals: {
    events: number;
    distinctIps: number;
    sharedIps: number;
    flaggedEntries: number;
    disqualifiedEntries: number;
    totalEntries: number;
  };
  sharedIps: IntegritySharedIp[];
  recent: IntegrityLogRow[];
}

// Cap the raw feed so a busy contest can't dump the entire log into one page.
const RECENT_LIMIT = 400;

/**
 * Site-wide integrity overview built from the contest IP/device log. Surfaces
 * the raw event feed, IPs shared by more than one entry (across all contests),
 * and headline counts for the dashboard tiles.
 */
export async function getIntegrityOverview(): Promise<IntegrityOverview> {
  const [logs, disqualifiedEntries, totalEntries] = await Promise.all([
    prisma.contestIpLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        entry: {
          select: {
            disqualifiedAt: true,
            user: { select: { name: true, username: true } },
          },
        },
        contest: { select: { name: true, slug: true } },
      },
    }),
    prisma.contestEntry.count({ where: { disqualifiedAt: { not: null } } }),
    prisma.contestEntry.count(),
  ]);

  const nameFor = (log: (typeof logs)[number]) =>
    log.entry?.user.username ?? log.entry?.user.name ?? "Entrant";

  // Group every log line by IP → the distinct entries that touched it.
  const byIp = new Map<
    string,
    Map<string, { name: string; contestName: string; hits: number; disqualified: boolean }>
  >();
  const distinctIps = new Set<string>();
  const lastSeenByIp = new Map<string, string>();

  for (const log of logs) {
    distinctIps.add(log.ip);
    if (!lastSeenByIp.has(log.ip)) lastSeenByIp.set(log.ip, log.createdAt.toISOString());
    let entries = byIp.get(log.ip);
    if (!entries) {
      entries = new Map();
      byIp.set(log.ip, entries);
    }
    const cur = entries.get(log.entryId);
    if (cur) cur.hits += 1;
    else
      entries.set(log.entryId, {
        name: nameFor(log),
        contestName: log.contest.name,
        hits: 1,
        disqualified: Boolean(log.entry?.disqualifiedAt),
      });
  }

  const flaggedEntryIds = new Set<string>();
  const sharedIps: IntegritySharedIp[] = [];
  for (const [ip, entries] of byIp) {
    if (entries.size < 2) continue; // a single entry per IP is normal
    for (const entryId of entries.keys()) flaggedEntryIds.add(entryId);
    sharedIps.push({
      ip,
      lastSeen: lastSeenByIp.get(ip) ?? "",
      entries: [...entries.entries()].map(([entryId, v]) => ({ entryId, ...v })),
    });
  }
  // Busiest / most-shared IPs first.
  sharedIps.sort((a, b) => b.entries.length - a.entries.length || b.lastSeen.localeCompare(a.lastSeen));

  const recent: IntegrityLogRow[] = logs.slice(0, RECENT_LIMIT).map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    ip: log.ip,
    userAgent: log.userAgent,
    entryId: log.entryId,
    entrantName: nameFor(log),
    contestName: log.contest.name,
    contestSlug: log.contest.slug,
    disqualified: Boolean(log.entry?.disqualifiedAt),
  }));

  return {
    totals: {
      events: logs.length,
      distinctIps: distinctIps.size,
      sharedIps: sharedIps.length,
      flaggedEntries: flaggedEntryIds.size,
      disqualifiedEntries,
      totalEntries,
    },
    sharedIps,
    recent,
  };
}
