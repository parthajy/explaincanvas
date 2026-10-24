import { z } from "zod";
import type { Format } from "@/lib/scene/schema";

/**
 * Pricing is configuration, not code scattered around the app.
 * All money is in paise (integer). GST is applied at checkout and shown before payment.
 */
export const GST_RATE = 0.18;

export const PlanCode = z.enum(["free", "student", "pro", "max", "max_annual"]);
export type PlanCode = z.infer<typeof PlanCode>;

export interface Plan {
  code: PlanCode;
  name: string;
  pricePaise: number;
  interval: "month" | "year" | "none";
  /** Credits granted each month (also for annual, granted monthly). */
  creditsPerMonth: number;
  /** How long unused plan credits stay valid past the period they were granted in. */
  rolloverDays: number;
  studentProfiles: number;
  parentReport: boolean;
  priorityRendering: boolean;
  premiumNarration: boolean;
  fastVideo: boolean;
  topupsAllowed: boolean;
  blurb: string;
}

export const PLANS: Record<PlanCode, Plan> = {
  free: {
    code: "free",
    name: "Free",
    pricePaise: 0,
    interval: "none",
    creditsPerMonth: 0,
    rolloverDays: 0,
    studentProfiles: 1,
    parentReport: false,
    priorityRendering: false,
    premiumNarration: false,
    fastVideo: false,
    topupsAllowed: false,
    blurb: "Unlimited library lessons, one fresh diagram, a streak credit a day.",
  },
  student: {
    code: "student",
    name: "Student",
    pricePaise: 599_00,
    interval: "month",
    creditsPerMonth: 250,
    rolloverDays: 30,
    studentProfiles: 1,
    parentReport: true,
    priorityRendering: false,
    premiumNarration: false,
    fastVideo: false,
    topupsAllowed: true,
    blurb: "About 9 fresh explanations a month today, 19 as the library grows. Daily parent report.",
  },
  pro: {
    code: "pro",
    name: "Pro",
    pricePaise: 1_999_00,
    interval: "month",
    creditsPerMonth: 900,
    rolloverDays: 30,
    studentProfiles: 2,
    parentReport: true,
    priorityRendering: true,
    premiumNarration: true,
    fastVideo: false,
    topupsAllowed: true,
    blurb: "Two students, priority rendering, premium narration.",
  },
  max: {
    code: "max",
    name: "Max",
    pricePaise: 4_999_00,
    interval: "month",
    creditsPerMonth: 2_500,
    rolloverDays: 30,
    studentProfiles: 4,
    parentReport: true,
    priorityRendering: true,
    premiumNarration: true,
    fastVideo: true,
    topupsAllowed: true,
    blurb: "Four students, priority rendering, premium narration, fast video.",
  },
  max_annual: {
    code: "max_annual",
    name: "Max Annual",
    pricePaise: 50_000_00,
    interval: "year",
    creditsPerMonth: 2_500,
    rolloverDays: 30,
    studentProfiles: 4,
    parentReport: true,
    priorityRendering: true,
    premiumNarration: true,
    fastVideo: true,
    topupsAllowed: true,
    blurb: "Everything in Max, two months free.",
  },
};

export const PAID_PLAN_CODES: PlanCode[] = ["student", "pro", "max", "max_annual"];

export const TopupCode = z.enum(["topup_small", "topup_medium", "topup_large"]);
export type TopupCode = z.infer<typeof TopupCode>;

export interface TopupPack {
  code: TopupCode;
  name: string;
  pricePaise: number;
  credits: number;
}

/** Top-ups work like Claude's extra usage: subscribers only, never expire while subscribed. */
export const TOPUPS: Record<TopupCode, TopupPack> = {
  topup_small: { code: "topup_small", name: "Small", pricePaise: 199_00, credits: 80 },
  topup_medium: { code: "topup_medium", name: "Medium", pricePaise: 499_00, credits: 220 },
  topup_large: { code: "topup_large", name: "Large", pricePaise: 999_00, credits: 480 },
};

/** Credits charged per output. Roughly 1 credit per rupee of our generation cost. */
export const CREDIT_COST: Record<Format | "library" | "followup", number> = {
  library: 1,
  followup: 2,
  diagram: 8,
  annotation: 10,
  three_d: 20,
  slides: 24,
  steps: 26,
  animation: 32,
  video: 65,
};

export const FREE_TIER = {
  /** One fresh generation per verified account, diagram renderer only. */
  freshGenerations: 1,
  freshGenerationFormat: "diagram" as Format,
  /** Streak credit granted per day with a passed check; spendable on library and follow-ups only. */
  streakCreditPerDay: 1,
  streakBucket: "streak",
};

export function gstOn(amountPaise: number): number {
  return Math.round(amountPaise * GST_RATE);
}

export function totalWithGst(amountPaise: number): { amountPaise: number; gstPaise: number; totalPaise: number } {
  const gstPaise = gstOn(amountPaise);
  return { amountPaise, gstPaise, totalPaise: amountPaise + gstPaise };
}

export function formatInr(paise: number): string {
  const rupees = paise / 100;
  return "₹" + rupees.toLocaleString("en-IN", { maximumFractionDigits: rupees % 1 === 0 ? 0 : 2 });
}

export function isPaidPlan(code: PlanCode): boolean {
  return code !== "free";
}

/** Buckets a free user may spend from for a given output. */
export function allowedBucketsFor(kind: Format | "library" | "followup", planCode: PlanCode): string[] | null {
  if (isPaidPlan(planCode)) return null; // any bucket
  if (kind === "library" || kind === "followup") return ["streak", "free", "promo", "plan", "topup"];
  return ["free", "promo"]; // fresh generations for free users only from the free grant
}
