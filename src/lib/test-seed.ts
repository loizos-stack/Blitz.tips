import type { BetType, HandicapperPlan, PickResult, PickSport, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Shared test-data generator used by both the CLI seed (prisma/seed-test.ts) and
// the temporary admin endpoint (/api/admin/seed-test). Idempotent: upserts users
// and profiles, and skips a handicapper's picks/reviews once they exist.
//
// Creates 15 handicappers with settled + pending picks, follows, active
// subscriptions, and approved reviews, plus 12 fan accounts. Popularity descends
// by index so the finder's Hot / Most followed / Most reviewed sorts differ.

const DEMO_PASSWORD = "password123";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEAMS: Record<PickSport, string[]> = {
  NFL: ["Chiefs", "Bills", "Eagles", "Cowboys", "49ers", "Ravens", "Lions", "Dolphins", "Packers", "Bengals"],
  NBA: ["Celtics", "Nuggets", "Bucks", "Suns", "Lakers", "Warriors", "Knicks", "Heat", "Mavericks", "Thunder"],
  MLB: ["Yankees", "Dodgers", "Braves", "Astros", "Orioles", "Phillies", "Rangers", "Padres", "Cubs", "Mets"],
  NHL: ["Avalanche", "Bruins", "Panthers", "Oilers", "Rangers", "Stars", "Golden Knights", "Maple Leafs", "Hurricanes", "Jets"],
  SOCCER: ["Arsenal", "Man City", "Liverpool", "Real Madrid", "Barcelona", "Bayern", "PSG", "Inter", "Chelsea", "Spurs"],
  WNBA: [], NCAAF: [], NCAAB: [], GOLF: [], TENNIS: [], UFC_MMA: [], OTHER: [],
};
const BET_TYPES: BetType[] = ["SPREAD", "TOTAL", "MONEYLINE"];

interface TestCapper {
  handle: string;
  displayName: string;
  sports: PickSport[];
  plan: HandicapperPlan;
  verified: boolean;
  monthly: number;
  bio: string;
}

const CAPPERS: TestCapper[] = [
  { handle: "gridironguru", displayName: "Gridiron Guru", sports: ["NFL"], plan: "GOLD", verified: true, monthly: 5999, bio: "NFL sides and totals. 10 years beating the number." },
  { handle: "hoopsherpa", displayName: "Hoop Sherpa", sports: ["NBA"], plan: "SILVER", verified: true, monthly: 3999, bio: "NBA player props and live spots." },
  { handle: "icevenom", displayName: "Ice Venom", sports: ["NHL"], plan: "FREE", verified: false, monthly: 1999, bio: "Puck lines and goalie edges nightly." },
  { handle: "dingerdon", displayName: "Dinger Don", sports: ["MLB"], plan: "GOLD", verified: true, monthly: 4499, bio: "MLB run lines, F5, and dingers." },
  { handle: "pitchperfect", displayName: "Pitch Perfect", sports: ["SOCCER"], plan: "SILVER", verified: true, monthly: 2999, bio: "Top-five leagues and Champions League." },
  { handle: "fadethepublic", displayName: "Fade The Public", sports: ["NFL", "NBA"], plan: "FREE", verified: false, monthly: 2499, bio: "Contrarian angles across the big two." },
  { handle: "courtvision", displayName: "Court Vision", sports: ["NBA"], plan: "SILVER", verified: true, monthly: 3499, bio: "Model-driven NBA totals." },
  { handle: "bluelinebandit", displayName: "Blueline Bandit", sports: ["NHL"], plan: "FREE", verified: false, monthly: 1799, bio: "Grinding NHL value all season." },
  { handle: "baseloaded", displayName: "Bases Loaded", sports: ["MLB"], plan: "FREE", verified: false, monthly: 1999, bio: "Bullpen-aware baseball plays." },
  { handle: "thegaffer", displayName: "The Gaffer", sports: ["SOCCER"], plan: "GOLD", verified: true, monthly: 3999, bio: "Global football, BTTS and Asian handicaps." },
  { handle: "prophetpicks", displayName: "Prophet Picks", sports: ["NFL"], plan: "SILVER", verified: true, monthly: 3299, bio: "Sunday sides with receipts." },
  { handle: "rimrattler", displayName: "Rim Rattler", sports: ["NBA"], plan: "FREE", verified: false, monthly: 1499, bio: "Up-and-coming NBA capper." },
  { handle: "slapshotsally", displayName: "Slapshot Sally", sports: ["NHL"], plan: "SILVER", verified: true, monthly: 2799, bio: "Special-teams-driven hockey picks." },
  { handle: "moneyballmax", displayName: "Moneyball Max", sports: ["MLB"], plan: "FREE", verified: false, monthly: 2199, bio: "Sabermetrics meets the sportsbook." },
  { handle: "touchlinetips", displayName: "Touchline Tips", sports: ["SOCCER"], plan: "FREE", verified: false, monthly: 1699, bio: "Weekend football multibets and singles." },
];

const REVIEW_BODIES = [
  "Up big following these plays — best value on the platform.",
  "Consistent and transparent. Every pick posted before lock.",
  "Great write-ups, not just picks. Learned a lot.",
  "Rough week but the long-term record speaks for itself.",
  "Cashed my first parlay off these. Subscribed for the year.",
  "Solid card most nights, communication is top notch.",
  "Exactly the discipline I needed. No chasing.",
  "",
];

export async function seedTestData(prisma: PrismaClient): Promise<{ handicappers: number; fans: number }> {
  const rng = mulberry32(20260717);
  const pickOf = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const makeSelection = (betType: BetType, home: string, away: string): string => {
    if (betType === "TOTAL") return `${rng() > 0.5 ? "Over" : "Under"} ${between(4, 9)}.5`;
    const team = rng() > 0.5 ? home : away;
    if (betType === "MONEYLINE") return `${team} ML`;
    return `${team} ${rng() > 0.5 ? "-" : "+"}${between(1, 7)}.5`;
  };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const fans = [];
  for (let i = 1; i <= 12; i++) {
    const email = `testfan${i}@blitz.tips`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, username: `testfan${i}`, name: `Test Fan ${i}`, passwordHash, role: "SUBSCRIBER", emailVerified: new Date() },
    });
    fans.push(user);
  }

  for (let c = 0; c < CAPPERS.length; c++) {
    const h = CAPPERS[c];
    const user = await prisma.user.upsert({
      where: { email: `${h.handle}@blitz.tips` },
      update: {},
      create: { email: `${h.handle}@blitz.tips`, username: h.handle, name: h.displayName, passwordHash, role: "HANDICAPPER", emailVerified: new Date() },
    });

    const profile = await prisma.handicapperProfile.upsert({
      where: { handle: h.handle },
      update: {},
      create: {
        userId: user.id,
        handle: h.handle,
        displayName: h.displayName,
        bio: h.bio,
        sports: h.sports,
        monthlyPriceCents: h.monthly,
        weeklyPriceCents: rng() > 0.5 ? Math.round(h.monthly / 3 / 100) * 100 - 1 : null,
        annualPriceCents: rng() > 0.4 ? h.monthly * 10 : null,
        isVerified: h.verified,
        plan: h.plan,
      },
    });

    // Picks — one createMany per capper instead of ~20 round-trips. Guarded so
    // re-runs (e.g. after a gateway timeout) don't duplicate.
    const existingPicks = await prisma.pick.count({ where: { handicapperId: profile.id } });
    if (existingPicks === 0) {
      const pickRows = [];
      const settledN = between(10, 18);
      const winRate = 0.4 + rng() * 0.35;
      for (let i = 0; i < settledN; i++) {
        const sport = pickOf(h.sports);
        const home = pickOf(TEAMS[sport]);
        let away = pickOf(TEAMS[sport]);
        while (away === home) away = pickOf(TEAMS[sport]);
        const betType = pickOf(BET_TYPES);
        const roll = rng();
        const result: PickResult = roll < winRate ? "WIN" : roll < winRate + 0.08 ? "PUSH" : "LOSS";
        const startsAt = new Date();
        startsAt.setDate(startsAt.getDate() - (settledN - i + between(0, 2)));
        pickRows.push({
          handicapperId: profile.id, sport, league: sport, matchup: `${away} @ ${home}`, betType,
          selection: makeSelection(betType, home, away),
          odds: pickOf([-110, -105, -120, 100, 105, -150, 130, -108]),
          units: pickOf([1, 1, 1.5, 2, 2, 3]), result, isPremium: rng() > 0.25,
          eventStartsAt: startsAt, settledAt: startsAt, createdAt: startsAt,
        });
      }
      const pendingN = between(1, 3);
      for (let i = 0; i < pendingN; i++) {
        const sport = pickOf(h.sports);
        const home = pickOf(TEAMS[sport]);
        let away = pickOf(TEAMS[sport]);
        while (away === home) away = pickOf(TEAMS[sport]);
        const betType = pickOf(BET_TYPES);
        const startsAt = new Date();
        startsAt.setDate(startsAt.getDate() + between(0, 2));
        pickRows.push({
          handicapperId: profile.id, sport, league: sport, matchup: `${away} @ ${home}`, betType,
          selection: makeSelection(betType, home, away),
          odds: pickOf([-110, -105, 100, -130, 120]), units: pickOf([1, 1.5, 2, 3]),
          result: "PENDING" as PickResult, isPremium: rng() > 0.25, eventStartsAt: startsAt, createdAt: new Date(),
        });
      }
      await prisma.pick.createMany({ data: pickRows });
    }

    const popularity = 1 - c / CAPPERS.length;
    const nSubs = Math.round(popularity * (fans.length - 2)) + between(0, 2);
    const shuffled = [...fans].sort(() => rng() - 0.5);
    const subs = shuffled.slice(0, Math.min(nSubs, fans.length));
    const extraFollowers = shuffled.slice(subs.length, subs.length + between(0, 3));

    // Batched, skipDuplicates keeps it idempotent across retries.
    await prisma.subscription.createMany({
      data: subs.map((fan) => ({
        subscriberId: fan.id, handicapperId: profile.id, status: "ACTIVE" as const,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })),
      skipDuplicates: true,
    });
    await prisma.follow.createMany({
      data: [...subs, ...extraFollowers].map((fan) => ({ followerId: fan.id, handicapperId: profile.id })),
      skipDuplicates: true,
    });

    const existingReviews = await prisma.review.count({ where: { handicapperId: profile.id } });
    if (existingReviews === 0) {
      const reviewers = subs.slice(0, Math.round(subs.length * (0.5 + rng() * 0.4)));
      await prisma.review.createMany({
        data: reviewers.map((fan) => ({
          handicapperId: profile.id, authorId: fan.id,
          rating: pickOf([5, 5, 4, 4, 4, 3]), body: pickOf(REVIEW_BODIES) || null,
          status: "APPROVED" as const, moderatedAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }
  }

  return { handicappers: CAPPERS.length, fans: fans.length };
}
