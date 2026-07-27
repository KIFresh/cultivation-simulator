import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    cultivator: { update: vi.fn() },
    gameEvent: { count: vi.fn() },
    $transaction: vi.fn(),
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

import { prisma } from "@/lib/prisma";
import { calcTravelCostByMode } from "@/lib";
import { resolveCombat } from "@/lib/combat-engine";
import { getEnemiesForLocation } from "@/lib/enemy-data";

const mockFindUnique = vi.mocked(prisma.user.findUnique) as any;
const mockCultivatorUpdate = vi.mocked(prisma.cultivator.update) as any;
const mockCalcTravel = vi.mocked(calcTravelCostByMode) as any;
const mockResolveCombat = vi.mocked(resolveCombat) as any;
const mockGetEnemies = vi.mocked(getEnemiesForLocation) as any;

const baseCultivator = {
  id: "c1", userId: "user1", name: "测试者", realm: "炼气期", realmLevel: 1,
  gold: 100, stamina: 80, location: "home", attributes: "{}", inventory: "[]", milestones: "{}",
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockCalcTravel.mockReturnValue({ staminaCost: 5, goldCost: 0 });
  mockResolveCombat.mockResolvedValue({ win: true, style: "overwhelm", enemy: { id: "e1", name: "敌", realm: "炼气期", combatPower: 100, rarity: "普通", locationIds: [] }, narrative: "胜利" } as any);
  mockGetEnemies.mockReturnValue([]);
});

describe("Travel API — 夺宝闭环", () => {
  it("非坊市离开不触发夺宝", async () => {
    mockFindUnique.mockResolvedValue({ id: "u1", cultivator: { ...baseCultivator, location: "wild" } });
    mockCultivatorUpdate.mockResolvedValue({ ...baseCultivator, location: "market" });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ userId: "user1", locationId: "market" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob).toBeNull();
  });

  it("坊市无越阶物品不触发夺宝", async () => {
    mockFindUnique.mockResolvedValue({ id: "u1", cultivator: { ...baseCultivator, location: "market", inventory: JSON.stringify([{ itemId: "qi_pill", quantity: 1, equipped: false }]) } });
    mockCultivatorUpdate.mockResolvedValue({ ...baseCultivator, location: "wild" });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ userId: "user1", locationId: "wild" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob).toBeNull();
  });

  it("概率边界：今日已夺宝过不触发", async () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
    mockFindUnique.mockResolvedValue({ id: "u1", cultivator: { ...baseCultivator, location: "market", inventory: JSON.stringify([{ itemId: "spirit_sword", quantity: 1, equipped: false }]), milestones: JSON.stringify({ robDate: key, robCount: 1 }) } });
    mockCultivatorUpdate.mockResolvedValue({ ...baseCultivator, location: "wild" });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ userId: "user1", locationId: "wild" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob).toBeNull();
  });

  it("服务端权威计价：忽略客户端传入的 staminaCost/goldCost", async () => {
    mockFindUnique.mockResolvedValue({ id: "u1", cultivator: baseCultivator });
    mockCultivatorUpdate.mockResolvedValue({ ...baseCultivator, location: "wild", stamina: 75, gold: 100 });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ userId: "user1", locationId: "wild", staminaCost: 0, goldCost: 0 }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.staminaCost).toBe(5); // calcTravelCostByMode 返回值
    expect(data.goldCost).toBe(0);
  });

  it("战败时丢失越阶物品", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1); // 15% 内触发
    mockFindUnique.mockResolvedValue({ id: "u1", cultivator: { ...baseCultivator, location: "market", inventory: JSON.stringify([{ itemId: "spirit_sword", quantity: 1, equipped: false }]), milestones: "{}" } });
    mockResolveCombat.mockResolvedValue({ win: false, style: "crushed", enemy: { id: "e1", name: "夺宝者", realm: "炼气期", combatPower: 1000, rarity: "精英", locationIds: ["market"] }, narrative: "战败" } as any);
    mockCultivatorUpdate.mockResolvedValue({ ...baseCultivator, location: "wild", inventory: "[]", milestones: JSON.stringify({ robDate: "2026-7-27", robCount: 1 }) });
    const req = new NextRequest(new URL("http://test/api/travel"), {
      method: "POST",
      body: JSON.stringify({ userId: "user1", locationId: "wild" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rob.triggered).toBe(true);
    expect(data.rob.win).toBe(false);
    expect(data.rob.targetItemId).toBe("spirit_sword");
    expect(mockCultivatorUpdate).toHaveBeenCalled();
    randomSpy.mockRestore();
  });
});
