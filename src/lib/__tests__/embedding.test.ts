import { describe, it, expect } from "vitest";
import { cosineSimilarity, topK } from "../embedding";

describe("cosineSimilarity", () => {
  it("identical vectors returns 1", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5);
  });

  it("orthogonal vectors returns 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("opposite vectors returns -1", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("empty vector returns 0", () => {
    expect(cosineSimilarity([], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [])).toBe(0);
  });

  it("mismatched lengths returns 0", () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });

  it("partial match returns value between 0 and 1", () => {
    const sim = cosineSimilarity([1, 2, 3], [1, 2, 1]);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe("topK", () => {
  it("returns top indices sorted by score", () => {
    const scores = [0.1, 0.9, 0.5, 0.8];
    const result = topK(scores, 2);
    expect(result).toEqual([1, 3]);
  });

  it("filters below minScore", () => {
    const scores = [0.1, 0.9, 0.2, 0.8];
    const result = topK(scores, 3, 0.5);
    expect(result).toEqual([1, 3]);
  });

  it("handles empty array", () => {
    expect(topK([], 3)).toEqual([]);
  });

  it("k > array length returns all above minScore", () => {
    const scores = [0.6, 0.8, 0.1];
    const result = topK(scores, 10, 0.5);
    expect(result).toEqual([1, 0]);
  });

  it("all below minScore returns empty", () => {
    const scores = [0.1, 0.2, 0.05];
    expect(topK(scores, 3, 0.3)).toEqual([]);
  });
});