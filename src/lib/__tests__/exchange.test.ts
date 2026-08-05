import { describe, it, expect } from "vitest";
import {
  GOLD_PER_STONE,
  computeExchange,
  tierLabel,
  type ExchangeBalances,
  type ExchangeDirection,
} from "../exchange";

const HAS: ExchangeBalances = { gold: 50000, low: 10, mid: 5, high: 2 };

describe("跨阶段货币兑换 — 汇率与标签", () => {
  it("汇率集中常量：下=200 / 中=2000 / 上=10000", () => {
    expect(GOLD_PER_STONE.low).toBe(200);
    expect(GOLD_PER_STONE.mid).toBe(2000);
    expect(GOLD_PER_STONE.high).toBe(10000);
  });

  it("tierLabel 返回中文品名", () => {
    expect(tierLabel("low")).toBe("下品灵石");
    expect(tierLabel("mid")).toBe("中品灵石");
    expect(tierLabel("high")).toBe("上品灵石");
  });
});

describe("跨阶段货币兑换 — 金币→灵石", () => {
  it("买 1 下品：花 200 金、得 1 下品", () => {
    const r = computeExchange("goldToStone", "low", 1, HAS);
    expect(r.ok).toBe(true);
    expect(r.goldDelta).toBe(-200);
    expect(r.stoneDelta).toEqual({ tier: "low", amount: 1 });
  });

  it("买 3 中品：花 6000 金、得 3 中品", () => {
    const r = computeExchange("goldToStone", "mid", 3, HAS);
    expect(r.ok).toBe(true);
    expect(r.goldDelta).toBe(-6000);
    expect(r.stoneDelta).toEqual({ tier: "mid", amount: 3 });
  });

  it("金币不足报错，且不返回任何增量", () => {
    const poor: ExchangeBalances = { gold: 100, low: 0, mid: 0, high: 0 };
    const r = computeExchange("goldToStone", "low", 1, poor);
    expect(r.ok).toBe(false);
    expect(r.goldDelta).toBe(0);
    expect(r.stoneDelta).toBeNull();
    expect(r.error).toContain("金币不足");
  });
});

describe("跨阶段货币兑换 — 灵石→金币", () => {
  it("卖 1 上品：得 10000 金、扣 1 上品", () => {
    const r = computeExchange("stoneToGold", "high", 1, HAS);
    expect(r.ok).toBe(true);
    expect(r.goldDelta).toBe(10000);
    expect(r.stoneDelta).toEqual({ tier: "high", amount: -1 });
  });

  it("灵石不足报错", () => {
    const r = computeExchange("stoneToGold", "high", 99, HAS);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("灵石不足");
  });
});

describe("跨阶段货币兑换 — 入参校验", () => {
  it("amount=0 报错", () => {
    const r = computeExchange("goldToStone", "low", 0, HAS);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("正整数");
  });

  it("amount 负数报错", () => {
    const r = computeExchange("goldToStone", "low", -3, HAS);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("正整数");
  });

  it("amount 非整数报错", () => {
    const r = computeExchange("stoneToGold", "low", 1.5, HAS);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("正整数");
  });

  it("无效灵石品级报错", () => {
    const r = computeExchange(
      "goldToStone",
      "none" as Exclude<ExchangeDirection, never> extends never ? never : any,
      1,
      HAS
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("无效的灵石品级");
  });
});

describe("跨阶段货币兑换 — 无套利（双向同率）", () => {
  it("先买后卖同量，净收支为 0", () => {
    const buy = computeExchange("goldToStone", "mid", 2, HAS);
    const afterBuy: ExchangeBalances = {
      gold: HAS.gold + buy.goldDelta,
      low: HAS.low,
      mid: HAS.mid + (buy.stoneDelta?.amount ?? 0),
      high: HAS.high,
    };
    const sell = computeExchange("stoneToGold", "mid", 2, afterBuy);
    expect(buy.goldDelta + sell.goldDelta).toBe(0);
    expect((buy.stoneDelta?.amount ?? 0) + (sell.stoneDelta?.amount ?? 0)).toBe(0);
  });
});
