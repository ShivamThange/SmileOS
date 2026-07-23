import { describe, it, expect } from "vitest";
import { inr, inrFromRupees, inrCompact } from "./format";

/*
 * Money formatting is the single source of truth for how every rupee renders,
 * so its edge cases (Indian grouping, lakh/crore compaction, zero, negatives)
 * are worth pinning — a formatting bug shows up on every screen at once.
 */

describe("inr — paise to grouped rupees", () => {
  it("groups with the Indian lakh/crore convention", () => {
    expect(inr(123456700)).toBe("₹12,34,567");
    expect(inr(100000)).toBe("₹1,000");
    expect(inr(50000)).toBe("₹500");
  });
  it("handles zero and sub-rupee rounding", () => {
    expect(inr(0)).toBe("₹0");
    expect(inr(150)).toBe("₹2"); // 1.5 rupees rounds to 2
  });
  it("carries the sign for negatives (refunds)", () => {
    expect(inr(-500000)).toBe("₹-5,000");
  });
});

describe("inrFromRupees — accepts a rupee figure directly", () => {
  it("groups without dividing by 100", () => {
    expect(inrFromRupees(1234567)).toBe("₹12,34,567");
    expect(inrFromRupees(999)).toBe("₹999");
  });
});

describe("inrCompact — tight chips", () => {
  it("compacts to k / L / Cr", () => {
    expect(inrCompact(480000000)).toBe("₹48L");
    expect(inrCompact(18500000)).toBe("₹1.85L");
    expect(inrCompact(480000)).toBe("₹4.8k");
    expect(inrCompact(12000000000)).toBe("₹12Cr");
  });
  it("drops trailing .00 / .0", () => {
    expect(inrCompact(10000000)).toBe("₹1L"); // 1.00L → ₹1L
    expect(inrCompact(500000)).toBe("₹5k"); // 5.0k → ₹5k
  });
  it("shows plain rupees below a thousand", () => {
    expect(inrCompact(45000)).toBe("₹450");
  });
});
