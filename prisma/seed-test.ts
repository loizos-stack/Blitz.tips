// Test-data seed: 15 fleshed-out handicappers with picks (settled + pending),
// follows, active subscriptions, and approved reviews — enough variety that the
// homepage finder's Hot / Most followed / Most reviewed sorts and the per-sport
// filters all produce visibly different results.
//
// Idempotent: re-running upserts users/profiles by unique key and skips a
// handicapper's picks/reviews once they exist. Run with:
//   npx tsx prisma/seed-test.ts
import { PrismaClient, type BetType, type HandicapperPlan, type PickResult, type PickSport } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "password123";

// Deterministic RNG so every run produces the same "random" data.
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
const rng = mulberry32(20260717);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

const TEAMS: Record<PickSport, string[]> = {
  NFL: ["Chiefs", "Bills", "Eagles", "Cowboys", "49ers", "Ravens", "Lions", "Dolphins", "Packers", "Bengals"],
  NBA: ["Celtics", "Nuggets", "Bucks", "Suns", "Lakers", "Warriors", "Knicks", "Heat", "Mavericks", "Thunder"],
  MLB: ["Yankees", "Dodgers", "Braves", "Astros", "Orioles", "Phillies", "Rangers", "Padres", "Cubs", "Mets"],
  NHL: ["Avalanche", "Bruins", "Panthers", "Oilers", "Rangers", "Stars", "Golden Knights", "Maple Leafs", "Hurricanes", "Jets"],
  SOCCER: ["Arsenal", "Man City", "Liverpool", "Real Madrid", "Barcelona", "Bayern", "PSG", "Inter", "Chelsea", "Spurs"],
  WNBA: [], NCAAF: [], NCAAB: [], GOLF: [], TENNIS: [], UFC_MMA: [], OTHER: [],
};
const BET_TYPES: BetType[] = ["SPREAD", "TOTAL", "MONEYLINE"];

function makeSelection(sport: PickSport, betType: BetType, home: string, away: string): string {
  if (betType === "TOTAL") return `${rng() > 0.5 ? "Over" : "Under"} ${between(4, 9)}.5`;
  const team = rng() > 0.5 ? home : away;
  if (betType === "MONEYLINE") return `${team} ML`;
  return `${team} ${rng() > 0.5 ? "-" : "+"}${between(1, 7)}.5`;
}

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

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // A pool of subscribers who follow / subscribe / review.
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
        weeklyPriceCents: rng() > 0.5 ? Math.round((h.monthly / 3) / 100) * 100 - 1 : null,
        annualPriceCents: rng() > 0.4 ? h.monthly * 10 : null,
        isVerified: h.verified,
        plan: h.plan,
      },
    });

    // Picks: a settled history (varied W/L/P) plus 1–3 pending.
    const existingPicks = await prisma.pick.count({ where: { handicapperId: profile.id } });
    if (existingPicks === 0) {
      const settledN = between(10, 18);
      const winRate = 0.4 + rng() * 0.35; // 40%–75%
      for (let i = 0; i < settledN; i++) {
        const sport = pick(h.sports);
        const home = pick(TEAMS[sport]);
        let away = pick(TEAMS[sport]);
        while (away === home) away = pick(TEAMS[sport]);
        const betType = pick(BET_TYPES);
        const roll = rng();
        const result: PickResult = roll < winRate ? "WIN" : roll < winRate + 0.08 ? "PUSH" : "LOSS";
        const daysAgo = settledN - i + between(0, 2);
        const startsAt = new Date();
        startsAt.setDate(startsAt.getDate() - daysAgo);
        await prisma.pick.create({
          data: {
            handicapperId: profile.id,
            sport, league: sport,
            matchup: `${away} @ ${home}`,
            betType,
            selection: makeSelection(sport, betType, home, away),
            odds: pick([-110, -105, -120, +100, +105, -150, +130, -108]),
            units: pick([1, 1, 1.5, 2, 2, 3]),
            result,
            isPremium: rng() > 0.25,
            eventStartsAt: startsAt,
            settledAt: startsAt,
            createdAt: startsAt,
          },
        });
      }
      const pendingN = between(1, 3);
      for (let i = 0; i < pendingN; i++) {
        const sport = pick(h.sports);
        const home = pick(TEAMS[sport]);
        let away = pick(TEAMS[sport]);
        while (away === home) away = pick(TEAMS[sport]);
        const betType = pick(BET_TYPES);
        const startsAt = new Date();
        startsAt.setDate(startsAt.getDate() + between(0, 2));
        await prisma.pick.create({
          data: {
            handicapperId: profile.id,
            sport, league: sport,
            matchup: `${away} @ ${home}`,
            betType,
            selection: makeSelection(sport, betType, home, away),
            odds: pick([-110, -105, +100, -130, +120]),
            units: pick([1, 1.5, 2, 3]),
            result: "PENDING",
            isPremium: rng() > 0.25,
            eventStartsAt: startsAt,
            createdAt: new Date(),
          },
        });
      }
    }

    // Popularity varies by index so the sorts differ: earlier cappers get more.
    const popularity = 1 - c / CAPPERS.length; // 1 → ~0
    const nSubs = Math.round(popularity * (fans.length - 2)) + between(0, 2);
    const shuffled = [...fans].sort(() => rng() - 0.5);
    const subs = shuffled.slice(0, Math.min(nSubs, fans.length));

    for (const fan of subs) {
      await prisma.subscription.upsert({
        where: { subscriberId_handicapperId: { subscriberId: fan.id, handicapperId: profile.id } },
        update: {},
        create: {
          subscriberId: fan.id,
          handicapperId: profile.id,
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      // Followers overlap with (but exceed) subscribers.
      await prisma.follow.upsert({
        where: { followerId_handicapperId: { followerId: fan.id, handicapperId: profile.id } },
        update: {},
        create: { followerId: fan.id, handicapperId: profile.id },
      });
    }
    // Some extra followers who don't subscribe.
    for (const fan of shuffled.slice(subs.length, subs.length + between(0, 3))) {
      await prisma.follow.upsert({
        where: { followerId_handicapperId: { followerId: fan.id, handicapperId: profile.id } },
        update: {},
        create: { followerId: fan.id, handicapperId: profile.id },
      });
    }

    // Approved reviews from a subset of subscribers.
    const existingReviews = await prisma.review.count({ where: { handicapperId: profile.id } });
    if (existingReviews === 0) {
      const reviewers = subs.slice(0, Math.round(subs.length * (0.5 + rng() * 0.4)));
      for (const fan of reviewers) {
        await prisma.review.create({
          data: {
            handicapperId: profile.id,
            authorId: fan.id,
            rating: pick([5, 5, 4, 4, 4, 3]),
            body: pick(REVIEW_BODIES) || null,
            status: "APPROVED",
            moderatedAt: new Date(),
          },
        });
      }
    }

    console.log(`seeded ${h.handle}: ${subs.length} subs`);
  }

  console.log("Test seed complete. 15 handicappers + 12 fans (password: password123).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
