import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateStreetOmen,
  DISTRICTS,
  loadStreetBoons,
  saveStreetBoon,
  type DistrictKey,
} from "@/lib/street-omen";

class MemStorage {
  private s: Record<string, string> = {};
  getItem(k: string) {
    return this.s[k] ?? null;
  }
  setItem(k: string, v: string) {
    this.s[k] = String(v);
  }
  removeItem(k: string) {
    delete this.s[k];
  }
  clear() {
    this.s = {};
  }
}

describe("generateStreetOmen", () => {
  it("同输入可复现", () => {
    const a = generateStreetOmen({ id: "u1", age: 20, quarter: 1, district: "oldtown" });
    const b = generateStreetOmen({ id: "u1", age: 20, quarter: 1, district: "oldtown" });
    expect(b).toEqual(a);
  });

  it("不同街区结果可能不同", () => {
    const districts: DistrictKey[] = ["oldtown", "commercial", "subway", "park", "bridge"];
    const results = new Set(
      districts.map((d) =>
        JSON.stringify(generateStreetOmen({ id: "u1", age: 20, quarter: 1, district: d }))
      )
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it("年龄低于奇人门槛不出现高门槛奇人", () => {
    for (let q = 1; q <= 8; q++) {
      for (const d of DISTRICTS) {
        const o = generateStreetOmen({
          id: "u1",
          age: 10,
          quarter: q,
          district: d.key as DistrictKey,
        });
        expect(o.omen.title).not.toBe("深夜古董店老板");
      }
    }
  });

  it("年龄足够大可出现奇人", () => {
    let sawSage = false;
    for (let q = 1; q <= 12; q++) {
      for (const d of DISTRICTS) {
        const o = generateStreetOmen({
          id: "u1",
          age: 20,
          quarter: q,
          district: d.key as DistrictKey,
        });
        if (o.omen.kind === "sage") sawSage = true;
      }
    }
    expect(sawSage).toBe(true);
  });

  it("年龄=0 边界不崩", () => {
    expect(() =>
      generateStreetOmen({ id: "x", age: 0, quarter: 1, district: "park" })
    ).not.toThrow();
  });
});

describe("street boons localStorage", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: new MemStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("保存后再读取一致", () => {
    const r1 = saveStreetBoon("u1", { title: "t", detail: "d" }, 1);
    expect(r1.length).toBe(1);
    const r2 = loadStreetBoons("u1");
    expect(r2[0].title).toBe("t");
  });

  it("上限 50 条", () => {
    for (let i = 0; i < 60; i++) saveStreetBoon("u1", { title: `t${i}`, detail: "d" }, 1);
    expect(loadStreetBoons("u1").length).toBe(50);
  });

  it("window 不存在时安全返回空", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(loadStreetBoons("u1")).toEqual([]);
    expect(saveStreetBoon("u1", { title: "t", detail: "d" }, 1)).toEqual([]);
  });
});
