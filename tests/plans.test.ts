import { describe, it, expect } from "vitest";
import { PLANS, TOPUPS, CREDIT_COST, totalWithGst, allowedBucketsFor, formatInr } from "@/lib/billing/plans";

describe("plans and pricing", () => {
  it("has the four paid tiers at the agreed prices", () => {
    expect(PLANS.student.pricePaise).toBe(59900);
    expect(PLANS.pro.pricePaise).toBe(199900);
    expect(PLANS.max.pricePaise).toBe(499900);
    expect(PLANS.max_annual.pricePaise).toBe(5000000);
    expect(PLANS.max_annual.interval).toBe("year");
  });

  it("sells plan credits at about ₹2 each or more (Max rounds to ₹2.00)", () => {
    for (const p of [PLANS.student, PLANS.pro, PLANS.max]) {
      expect(p.pricePaise / p.creditsPerMonth).toBeGreaterThanOrEqual(199);
    }
    expect(PLANS.max_annual.pricePaise / 12 / PLANS.max_annual.creditsPerMonth).toBeGreaterThanOrEqual(160);
  });

  it("prices top-ups above plan credits", () => {
    for (const t of Object.values(TOPUPS)) {
      expect(t.pricePaise / t.credits).toBeGreaterThan(200);
    }
  });

  it("applies 18% GST", () => {
    expect(totalWithGst(59900)).toEqual({ amountPaise: 59900, gstPaise: 10782, totalPaise: 70682 });
  });

  it("formats rupees in Indian style", () => {
    expect(formatInr(5000000)).toBe("₹50,000");
    expect(formatInr(59900)).toBe("₹599");
  });

  it("free users can only fund fresh generations from the free bucket", () => {
    expect(allowedBucketsFor("diagram", "free")).toEqual(["free", "promo"]);
    expect(allowedBucketsFor("library", "free")).toContain("streak");
    expect(allowedBucketsFor("animation", "student")).toBeNull();
  });

  it("charges roughly one credit per rupee of cost", () => {
    expect(CREDIT_COST.diagram).toBe(8);
    expect(CREDIT_COST.video).toBe(65);
    expect(CREDIT_COST.library).toBe(1);
  });
});
