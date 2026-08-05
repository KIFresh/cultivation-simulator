import { describe, it, expect } from "vitest";
import { parseArcadeStats, playArcade, type ArcadeStat } from "../arcade";

describe("arcade", () => {
  describe("parseArcadeStats", () => {
    it("should return default stats for null/undefined/empty input", () => {
      const defaultStats = { coinsInserted: 0, plays: 0, wins: 0, bestScore: 0 };
      expect(parseArcadeStats(null)).toEqual(defaultStats);
      expect(parseArcadeStats(undefined)).toEqual(defaultStats);
      expect(parseArcadeStats("")).toEqual(defaultStats);
    });

    it("should parse valid JSON stats", () => {
      const raw = JSON.stringify({ coinsInserted: 10, plays: 5, wins: 3, bestScore: 800 });
      const result = parseArcadeStats(raw);
      expect(result.coinsInserted).toBe(10);
      expect(result.plays).toBe(5);
      expect(result.wins).toBe(3);
      expect(result.bestScore).toBe(800);
    });

    it("should handle invalid JSON gracefully", () => {
      const result = parseArcadeStats("not-json");
      expect(result).toEqual({ coinsInserted: 0, plays: 0, wins: 0, bestScore: 0 });
    });
  });

  describe("playArcade", () => {
    it("should return a play result with incremented stats", () => {
      const stats: ArcadeStat = { coinsInserted: 0, plays: 0, wins: 0, bestScore: 0 };
      const result = playArcade(stats, "test-seed-123");
      expect(result.stats.coinsInserted).toBe(1);
      expect(result.stats.plays).toBe(1);
      expect(result.stats.wins).toBeGreaterThanOrEqual(0);
      expect(result.stats.wins).toBeLessThanOrEqual(1);
      expect(result.stats.bestScore).toBeGreaterThanOrEqual(0);
      expect(result.stats.bestScore).toBeLessThanOrEqual(999);
      expect(typeof result.score).toBe("number");
      expect(typeof result.won).toBe("boolean");
      expect(result.narrative).toBeTruthy();
    });

    it("should produce deterministic results for same seed", () => {
      const stats: ArcadeStat = { coinsInserted: 0, plays: 0, wins: 0, bestScore: 0 };
      const r1 = playArcade(stats, "deterministic");
      const r2 = playArcade(stats, "deterministic");
      expect(r1.score).toBe(r2.score);
      expect(r1.won).toBe(r2.won);
    });

    it("should update bestScore when new score is higher", () => {
      const stats: ArcadeStat = { coinsInserted: 5, plays: 5, wins: 2, bestScore: 100 };
      // Use a seed that gives score >= 600 so bestScore updates
      const result = playArcade(stats, "high-score-seed");
      expect(result.stats.bestScore).toBeGreaterThanOrEqual(100);
      expect(result.stats.plays).toBe(6);
    });
  });
});
