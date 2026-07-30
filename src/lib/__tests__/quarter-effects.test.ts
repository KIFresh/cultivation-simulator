import { describe, it, expect } from "vitest";
import { DETOX_PER_QUARTER, decayToxicity } from "../quarter-effects";

describe("DETOX_PER_QUARTER", () => {
  it("should be 3", () => {
    expect(DETOX_PER_QUARTER).toBe(3);
  });
});

describe("decayToxicity", () => {
  it("should decay a normal value (10 → 7)", () => {
    expect(decayToxicity(10)).toBe(7);
  });

  it("should decay to 0 when current equals DETOX_PER_QUARTER (3 → 0)", () => {
    expect(decayToxicity(3)).toBe(0);
  });

  it("should decay to 0 when current is less than DETOX_PER_QUARTER (2 → 0)", () => {
    expect(decayToxicity(2)).toBe(0);
  });

  it("should return 0 when current is 0", () => {
    expect(decayToxicity(0)).toBe(0);
  });

  it("should return 0 when current is negative", () => {
    expect(decayToxicity(-5)).toBe(0);
  });

  it("should handle a large value", () => {
    expect(decayToxicity(1_000_000)).toBe(1_000_000 - DETOX_PER_QUARTER);
  });
});