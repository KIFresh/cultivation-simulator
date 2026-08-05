import { describe, it, expect } from "vitest";
import { REINCARNATION_TALENT_POOL } from "../reincarnation-data";

describe("REINCARNATION_TALENT_POOL", () => {
  it("has 4 talents", () => {
    expect(REINCARNATION_TALENT_POOL).toHaveLength(4);
  });

  it("each talent has required fields", () => {
    for (const t of REINCARNATION_TALENT_POOL) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.desc).toBeTruthy();
    }
  });

  it("all talent IDs are unique", () => {
    const ids = REINCARNATION_TALENT_POOL.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});