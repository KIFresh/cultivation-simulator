import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock auth helpers
vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: vi.fn(),
}));

// Mock narrative effects
vi.mock("@/lib/narrative-effects", () => ({
  applyEffects: vi.fn().mockResolvedValue(undefined),
  clampEffectsArray: vi.fn((effects) => effects),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((cb) => cb({
      cultivator: { update: vi.fn() },
    })),
  },
}));

// Mock travel cost
vi.mock("@/lib", () => ({
  calcTravelCostByMode: vi.fn(() => ({ staminaCost: 5, goldCost: 0 })),
}));

// Mock combat engine
vi.mock("@/lib/combat-engine", () => ({
  resolveCombat: vi.fn(),
}));

// Mock enemy data
vi.mock("@/lib/enemy-data", () => ({
  getEnemiesForLocation: vi.fn(() => []),
}));

import { requireCultivator } from "@/lib/auth-helpers";
import { calcTravelCostByMode } from "@/lib";
import { resolveCombat } from "@/lib/combat-engine";

const mockRequireCultivator = vi.mocked(requireCultivator) as any;
const mockCalcTravel = vi.mocked(calcTravelCostByMode) as any;
const mockResolveCombat = vi.mocked(resolveCombat) as any;

const baseCultivator = {
  id: "c1", userId: "user1", name: "测试者", realm: "炼气期", realmLevel: 1,
  gold: 100, stamina: 80, location: "home", attributes: "{}", inventory: "[]", milestones: "{}",
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockCalcTravel.mockReturnValue({ staminaCost: 5, goldCost: 0 });
  mockResolveCombat.mockResolvedValue({ win: true, style: "overwhelm", enemy: { id: "e1", name: "敌", realm: "炼气期", combatPower: 100, rarity: "普通", locationIds: [] }, narrative: "胜利" } as any);
  mockRequireCultivator.mockResolvedValue({ cultivator: baseCultivator });
});

describe("Travel API — 夺宝闭环", () => {
  it("非坊市离开不触发夺宝", async () => {
    mockRequireCultivator.mockResolvedValue({ cultivator: { ...baseCultivator, location: "wild" } });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ locationId: "market" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob).toBeNull();
  });

  it("坊市无越阶物品不触发夺宝", async () => {
    mockRequireCultivator.mockResolvedValue({ cultivator: { ...baseCultivator, location: "market", inventory: JSON.stringify([{ itemId: "qi_pill", quantity: 1, equipped: false }]) } });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ locationId: "wild" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob).toBeNull();
  });

  it("概率边界：今日已夺宝过不触发", async () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const key = `${today.getFullYear()}-${mm}-${dd}`;
    mockRequireCultivator.mockResolvedValue({ cultivator: { ...baseCultivator, location: "market", inventory: JSON.stringify([{ itemId: "spirit_sword", quantity: 1, equipped: false }]), milestones: JSON.stringify({ robDate: key, robCount: 1 }) } });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ locationId: "wild" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob).toBeNull();
  });

  it("服务端权威计价：忽略客户端传入的 staminaCost/goldCost", async () => {
    mockRequireCultivator.mockResolvedValue({ cultivator: baseCultivator });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ locationId: "wild", staminaCost: 0, goldCost: 0 }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.staminaCost).toBe(5);
    expect(data.goldCost).toBe(0);
  });

  it("战败时丢失越阶物品", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);
    mockRequireCultivator.mockResolvedValue({ cultivator: { ...baseCultivator, location: "market", inventory: JSON.stringify([{ itemId: "spirit_sword", quantity: 1, equipped: false }]), milestones: "{}" } });
    mockResolveCombat.mockResolvedValue({ win: false, style: "crushed", enemy: { id: "e1", name: "夺宝者", realm: "炼气期", combatPower: 1000, rarity: "精英", locationIds: ["market"] }, narrative: "战败" } as any);
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ locationId: "wild" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob.triggered).toBe(true);
    expect(data.rob.win).toBe(false);
    expect(data.rob.targetItemId).toBe("spirit_sword");
    randomSpy.mockRestore();
  });
});