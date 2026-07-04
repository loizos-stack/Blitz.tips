import { PrismaClient, type BetType, type HandicapperPlan, type PickResult, type PickSport } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

interface SeedPick {
  sport: PickSport;
  league?: string;
  matchup: string;
  betType: BetType;
  selection: string;
  odds: number;
  units: number;
  result: PickResult;
  daysAgo: number;
  isPremium?: boolean;
  analysis?: string;
}

interface SeedHandicapper {
  handle: string;
  displayName: string;
  email: string;
  bio: string;
  sports: PickSport[];
  monthlyPriceCents: number;
  isVerified?: boolean;
  plan?: HandicapperPlan;
  picks: SeedPick[];
}

const handicappers: SeedHandicapper[] = [
  {
    handle: "sharpsteve",
    displayName: "Sharp Steve",
    email: "sharpsteve@blitz.tips",
    bio: "Former line manager turned full-time NFL and NBA handicapper. Numbers over narratives.",
    sports: ["NFL", "NBA"],
    monthlyPriceCents: 4999,
    isVerified: true,
    picks: [
      { sport: "NFL", league: "NFL", matchup: "Chiefs @ Bills", betType: "SPREAD", selection: "Bills -2.5", odds: -110, units: 2, result: "WIN", daysAgo: 20, analysis: "Bills defense has dominated at home this month." },
      { sport: "NFL", league: "NFL", matchup: "Cowboys @ Eagles", betType: "TOTAL", selection: "Under 47.5", odds: -108, units: 1.5, result: "WIN", daysAgo: 18 },
      { sport: "NFL", league: "NFL", matchup: "49ers @ Rams", betType: "MONEYLINE", selection: "49ers ML", odds: -145, units: 3, result: "LOSS", daysAgo: 16 },
      { sport: "NBA", league: "NBA", matchup: "Celtics @ Bucks", betType: "SPREAD", selection: "Celtics -4", odds: -112, units: 2, result: "WIN", daysAgo: 14 },
      { sport: "NBA", league: "NBA", matchup: "Nuggets @ Suns", betType: "TOTAL", selection: "Over 228.5", odds: -105, units: 1, result: "LOSS", daysAgo: 12 },
      { sport: "NFL", league: "NFL", matchup: "Ravens @ Steelers", betType: "SPREAD", selection: "Ravens -3", odds: -110, units: 2, result: "WIN", daysAgo: 10 },
      { sport: "NBA", league: "NBA", matchup: "Warriors @ Lakers", betType: "MONEYLINE", selection: "Lakers ML", odds: 128, units: 1.5, result: "WIN", daysAgo: 8 },
      { sport: "NFL", league: "NFL", matchup: "Dolphins @ Jets", betType: "TOTAL", selection: "Under 41.5", odds: -110, units: 1, result: "PUSH", daysAgo: 6 },
      { sport: "NBA", league: "NBA", matchup: "Heat @ Knicks", betType: "SPREAD", selection: "Knicks -6.5", odds: -110, units: 2, result: "WIN", daysAgo: 4 },
      { sport: "NFL", league: "NFL", matchup: "Bengals @ Browns", betType: "MONEYLINE", selection: "Bengals ML", odds: -160, units: 3, result: "PENDING", daysAgo: 0 },
    ],
  },
  {
    handle: "puckqueen",
    displayName: "Puck Queen",
    email: "puckqueen@blitz.tips",
    bio: "NHL specialist. I watch every game so you don't have to.",
    sports: ["NHL"],
    monthlyPriceCents: 3499,
    isVerified: true,
    plan: "GOLD",
    picks: [
      { sport: "NHL", league: "NHL", matchup: "Oilers @ Avalanche", betType: "MONEYLINE", selection: "Avalanche ML", odds: -135, units: 2, result: "WIN", daysAgo: 22 },
      { sport: "NHL", league: "NHL", matchup: "Rangers @ Bruins", betType: "TOTAL", selection: "Over 5.5", odds: -115, units: 1, result: "LOSS", daysAgo: 19 },
      { sport: "NHL", league: "NHL", matchup: "Panthers @ Maple Leafs", betType: "SPREAD", selection: "Panthers +1.5", odds: -180, units: 3, result: "WIN", daysAgo: 15 },
      { sport: "NHL", league: "NHL", matchup: "Stars @ Golden Knights", betType: "MONEYLINE", selection: "Stars ML", odds: 118, units: 1.5, result: "WIN", daysAgo: 11 },
      { sport: "NHL", league: "NHL", matchup: "Devils @ Islanders", betType: "TOTAL", selection: "Under 6", odds: -105, units: 1, result: "LOSS", daysAgo: 7 },
      { sport: "NHL", league: "NHL", matchup: "Kraken @ Canucks", betType: "SPREAD", selection: "Canucks -1.5", odds: 145, units: 1, result: "WIN", daysAgo: 3 },
      { sport: "NHL", league: "NHL", matchup: "Jets @ Wild", betType: "MONEYLINE", selection: "Jets ML", odds: -125, units: 2, result: "PENDING", daysAgo: 0 },
    ],
  },
  {
    handle: "diamondking",
    displayName: "Diamond King",
    email: "diamondking@blitz.tips",
    bio: "MLB run lines, totals, and first-five props. Grinding every day of the season.",
    sports: ["MLB"],
    monthlyPriceCents: 2999,
    plan: "SILVER",
    picks: [
      { sport: "MLB", league: "MLB", matchup: "Yankees @ Red Sox", betType: "MONEYLINE", selection: "Yankees ML", odds: -150, units: 3, result: "LOSS", daysAgo: 25 },
      { sport: "MLB", league: "MLB", matchup: "Dodgers @ Giants", betType: "SPREAD", selection: "Dodgers -1.5", odds: 135, units: 1, result: "WIN", daysAgo: 21 },
      { sport: "MLB", league: "MLB", matchup: "Astros @ Rangers", betType: "TOTAL", selection: "Under 8.5", odds: -110, units: 1.5, result: "WIN", daysAgo: 17 },
      { sport: "MLB", league: "MLB", matchup: "Braves @ Mets", betType: "MONEYLINE", selection: "Braves ML", odds: -120, units: 2, result: "WIN", daysAgo: 13 },
      { sport: "MLB", league: "MLB", matchup: "Orioles @ Blue Jays", betType: "TOTAL", selection: "Over 9", odds: -105, units: 1, result: "LOSS", daysAgo: 9 },
      { sport: "MLB", league: "MLB", matchup: "Phillies @ Padres", betType: "SPREAD", selection: "Phillies -1.5", odds: 150, units: 1, result: "WIN", daysAgo: 5 },
      { sport: "MLB", league: "MLB", matchup: "Cubs @ Cardinals", betType: "MONEYLINE", selection: "Cubs ML", odds: 105, units: 1.5, result: "PENDING", daysAgo: 0, isPremium: false },
    ],
  },
  {
    handle: "roughrider",
    displayName: "Rough Rider",
    email: "roughrider@blitz.tips",
    bio: "Newer to the platform, building a track record in college football.",
    sports: ["NCAAF"],
    monthlyPriceCents: 1999,
    picks: [
      { sport: "NCAAF", league: "NCAAF", matchup: "Georgia @ Alabama", betType: "SPREAD", selection: "Alabama +3", odds: -110, units: 2, result: "LOSS", daysAgo: 12 },
      { sport: "NCAAF", league: "NCAAF", matchup: "Ohio State @ Michigan", betType: "TOTAL", selection: "Under 44.5", odds: -108, units: 1, result: "LOSS", daysAgo: 8 },
      { sport: "NCAAF", league: "NCAAF", matchup: "Texas @ Oklahoma", betType: "MONEYLINE", selection: "Texas ML", odds: -130, units: 2, result: "WIN", daysAgo: 4 },
    ],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const h of handicappers) {
    const user = await prisma.user.upsert({
      where: { email: h.email },
      update: {},
      create: {
        email: h.email,
        name: h.displayName,
        passwordHash,
        role: "HANDICAPPER",
      },
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
        monthlyPriceCents: h.monthlyPriceCents,
        isVerified: h.isVerified ?? false,
        plan: h.plan ?? "FREE",
      },
    });

    const existingPickCount = await prisma.pick.count({ where: { handicapperId: profile.id } });
    if (existingPickCount > 0) continue; // already seeded — re-running would just duplicate picks

    for (const p of h.picks) {
      const eventStartsAt = new Date();
      eventStartsAt.setDate(eventStartsAt.getDate() - p.daysAgo);

      await prisma.pick.create({
        data: {
          handicapperId: profile.id,
          sport: p.sport,
          league: p.league,
          matchup: p.matchup,
          betType: p.betType,
          selection: p.selection,
          odds: p.odds,
          units: p.units,
          result: p.result,
          isPremium: p.isPremium ?? true,
          analysis: p.analysis,
          eventStartsAt,
          settledAt: p.result === "PENDING" ? null : eventStartsAt,
          createdAt: eventStartsAt,
        },
      });
    }
  }

  const subscriber = await prisma.user.upsert({
    where: { email: "subscriber@blitz.tips" },
    update: {},
    create: {
      email: "subscriber@blitz.tips",
      name: "Demo Subscriber",
      passwordHash,
      role: "SUBSCRIBER",
    },
  });

  const sharpSteve = await prisma.handicapperProfile.findUnique({ where: { handle: "sharpsteve" } });
  if (sharpSteve) {
    await prisma.subscription.upsert({
      where: { subscriberId_handicapperId: { subscriberId: subscriber.id, handicapperId: sharpSteve.id } },
      update: {},
      create: {
        subscriberId: subscriber.id,
        handicapperId: sharpSteve.id,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo login password for all seeded accounts: ${DEMO_PASSWORD}`);
  console.log("Handicappers:", handicappers.map((h) => h.email).join(", "));
  console.log("Subscriber: subscriber@blitz.tips (subscribed to sharpsteve)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
