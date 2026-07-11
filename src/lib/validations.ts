import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name is too short").max(60),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  country: z.string().min(2, "Select your country").max(60).optional(),
});

export const becomeHandicapperSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(24, "Handle must be 24 characters or fewer")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only"),
  displayName: z.string().min(2).max(60),
  bio: z.string().max(1000).optional(),
  sports: z.array(z.string()).min(1, "Pick at least one sport"),
  monthlyPriceCents: z
    .number()
    .int()
    .min(499, "Minimum price is $4.99")
    .max(99999, "Max price is $999.99"),
  weeklyPriceCents: z
    .number()
    .int()
    .min(199, "Minimum weekly price is $1.99")
    .max(99999, "Max price is $999.99")
    .nullish(),
  annualPriceCents: z
    .number()
    .int()
    .min(999, "Minimum annual price is $9.99")
    .max(999999, "Max annual price is $9,999.99")
    .nullish(),
});

// Dashboard price updates share the same package constraints.
export const updatePricingSchema = becomeHandicapperSchema.pick({
  monthlyPriceCents: true,
  weeklyPriceCents: true,
  annualPriceCents: true,
});

export const createPickSchema = z.object({
  sport: z.string(),
  league: z.string().max(60).optional(),
  matchup: z.string().min(2).max(140),
  betType: z.string(),
  selection: z.string().min(1).max(140),
  odds: z
    .number()
    .int()
    .refine((v) => v !== 0 && (v >= 100 || v <= -100), "Odds must be +100/-100 or beyond"),
  units: z.number().min(0.1).max(20),
  analysis: z.string().max(2000).optional(),
  isPremium: z.boolean().default(true),
  eventStartsAt: z.string().min(1, "Event start time is required"),
  oddsApiEventId: z.string().max(64).optional(),
  oddsApiSportKey: z.string().max(64).optional(),
});

const oddsValue = z
  .number()
  .int()
  .refine((v) => v !== 0 && (v >= 100 || v <= -100), "Odds must be +100/-100 or beyond");

export const parlayLegSchema = z.object({
  sport: z.string().optional(),
  league: z.string().max(60).optional(),
  matchup: z.string().min(2).max(140),
  selection: z.string().min(1).max(140),
  odds: oddsValue,
  oddsApiEventId: z.string().max(64).optional(),
  oddsApiSportKey: z.string().max(64).optional(),
});

export const createParlaySchema = z.object({
  sport: z.string(),
  units: z.number().min(0.1).max(20),
  analysis: z.string().max(2000).optional(),
  isPremium: z.boolean().default(true),
  eventStartsAt: z.string().min(1, "Event start time is required"),
  legs: z.array(parlayLegSchema).min(2, "A parlay needs at least 2 legs").max(12),
});

export const settlePickSchema = z.object({
  result: z.enum(["WIN", "LOSS", "PUSH", "VOID", "PENDING"]),
});
