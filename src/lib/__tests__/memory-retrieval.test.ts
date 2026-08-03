import { describe, it, expect } from "vitest";
import { cosineSimilarity, topK } from "../embedding";

describe("memory retrieval - cosine similarity", () => {
  it("finds most similar vector among candidates", () => {
    const query = [1, 0, 0];
    const candidates = [
      [0.9, 0.1, 0],  // similar
      [0, 1, 0],      // orthogonal
      [-0.8, 0.2, 0], // opposite-ish
    ];
    const scores = candidates.map((c) => cosineSimilarity(query, c));
    const top = topK(scores, 1);
    expect(top[0]).toBe(0); // first candidate is most similar
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  it("topK returns empty for all low scores", () => {
    const scores = [0.1, 0.2, 0.05];
    expect(topK(scores, 2, 0.5)).toEqual([]);
  });

  it("topK respects limit", () => {
    const scores = [0.9, 0.8, 0.7, 0.6];
    expect(topK(scores, 2, 0.5)).toHaveLength(2);
    expect(topK(scores, 5, 0.5)).toHaveLength(4);
  });
});