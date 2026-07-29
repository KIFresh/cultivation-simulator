import { describe, expect, it } from "vitest";
import {
  CAREER_CATEGORIES,
  getWorldEra,
  normalizeWorldYear,
} from "../world-era";

describe("getWorldEra", () => {
  it.each([
    [2025, "contemporary", "现代都市"],
    [2039, "contemporary", "现代都市"],
    [2040, "digital", "数字转型"],
    [2055, "automation", "智能协同"],
  ])("returns the expected era at %i", (worldYear, key, label) => {
    const era = getWorldEra(worldYear);

    expect(era.key).toBe(key);
    expect(era.label).toBe(label);
  });
});

describe("normalizeWorldYear", () => {
  it.each([null, -1, 0, 2024, 2025.5, "2025", undefined])(
    "falls back to 2025 for %j",
    (value) => {
      expect(normalizeWorldYear(value)).toBe(2025);
    },
  );
});

describe("world era definitions", () => {
  it.each([2025, 2040, 2055])(
    "has a positive income multiplier and allowed career weights at %i",
    (worldYear) => {
      const era = getWorldEra(worldYear);

      expect(era.incomeMultiplier).toBeGreaterThan(0);
      for (const category of Object.keys(era.careerWeights)) {
        expect(CAREER_CATEGORIES).toContain(category);
      }
    },
  );
});
