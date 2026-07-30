import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";

// ── Mocks ──────────────────────────────────────────────────

const fakeCultivator: any = {
  id: "c1",
  userId: "u1",
  name: "测试弟子",
  spiritualRoot: "杂灵根",
  realm: "凡人",
  realmLevel: 0,
  age: 8,
  quarter: 1,
  worldYear: 2025,
  stamina: 20,
  toxicity: 5,
  injuryDebuff: 0,
  occupation: "务农",
  schoolRank: 0,
  worldId: "earth",
  attributes: { root: 5, spirit: 3, insight: 4, luck: 2, charm: 3, mind: 3 },
  cultivationExp: 0,
  totalExp: 0,
  breakthroughBuff: 0,
  bonusAge: 0,
  maxAge: null,
  reincarnationCount: 0,
  health: 100,
  gold: 50,
  storyEntries: null,
  location: "home",
  inventory: null,
  npcRelations: null,
  unlockedLocations: null,
  classEnroll: null,
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    cultivator: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    familyMember: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: vi.fn(),
  apiError: (msg: string, status: number, code?: string) =>
    NextResponse.json({ error: msg, code }, { status }),
}));

import { requireCultivator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

function mockAuth(cultivator: any = fakeCultivator) {
  vi.mocked(requireCultivator).mockResolvedValueOnce({
    cultivator: {
      ...cultivator,
      user: { id: cultivator.userId, name: "测试用户" },
    },
  });
}

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Map([["x-user-id", "u1"]]),
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.cultivator.findUnique).mockReset();
});

// ── 普通季度推进（非跨年） ──────────────────────────────────

describe("POST /api/advance-quarter — 普通季度推进（非跨年）", () => {
  function setupOk(cultivator: any = fakeCultivator) {
    mockAuth(cultivator);
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue(cultivator);
  }

  it("体力回满到当前上限", async () => {
    setupOk({ ...fakeCultivator, stamina: 10 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    // age=8, root=5 -> calculateMaxStamina = 13 + 3 = 16
    expect(updates.data.stamina).toBe(16);
  });

  it("丹毒衰减（10 -> 7）", async () => {
    setupOk({ ...fakeCultivator, toxicity: 10 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.toxicity).toBe(7);
  });

  it("丹毒不低于 0", async () => {
    setupOk({ ...fakeCultivator, toxicity: 1 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.toxicity).toBe(0);
  });

  it("健康恢复 +1（95 -> 96）", async () => {
    setupOk({ ...fakeCultivator, health: 95 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.health).toBe(96);
  });

  it("健康不超上限 100", async () => {
    setupOk({ ...fakeCultivator, health: 100 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.health).toBe(100);
  });

  it("健康为 0 时不恢复", async () => {
    setupOk({ ...fakeCultivator, health: 0 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.health).toBe(0);
  });
});

// ── 跨年场景 ──────────────────────────────────────────────

describe("POST /api/advance-quarter — 跨年", () => {
  function setupWrap(cultivator: any) {
    mockAuth(cultivator);
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue(cultivator);
  }

  it("年龄 +1、属性增长、未超寿、可突破提示", async () => {
    const cultivator = {
      ...fakeCultivator,
      quarter: 4,
      age: 15,
      realm: "炼气期",
      realmLevel: 1,
      cultivationExp: 100,
      health: 100,
      maxAge: 200,
    };
    setupWrap(cultivator);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.yearWrapped).toBe(true);
    expect(body.newAge).toBe(16);
    expect(body.worldYear).toBe(2026);
    expect(body.remaining).toBeGreaterThan(0);
    expect(body.maxAge).toBeGreaterThan(0);
    expect(body.canBreakthrough).toBe(true);
    expect(body.newAttributes).toBeTruthy();
  });

  it("世界年份递增", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, worldYear: 2025 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.worldYear).toBe(2026);
  });

  it("schoolRank 从 Int 转换并持久化", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, age: 8, schoolRank: 1 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.schoolRank).toBe(1);
  });

  it("重伤 debuff 按年递减", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, injuryDebuff: 5 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.injuryDebuff).toBe(4);
  });

  it("16 岁触发灵气觉醒", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, age: 15 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.awakenEvent).toBeTruthy();
    expect(body.awakenEvent.title).toContain("觉醒");
  });
});

// ── 跨年道消 ──────────────────────────────────────────────

describe("POST /api/advance-quarter — 跨年道消", () => {
  it("年龄超过 maxAge 时返回 daoXiao: true", async () => {
    // calculateMaxAge('凡人', {root:5,mind:3,...}, 0) = 80 + 10 + 3 = 93
    mockAuth({ ...fakeCultivator, quarter: 4, age: 100, realm: "凡人", bonusAge: 0 });
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.daoXiao).toBe(true);
    expect(vi.mocked(prisma.cultivator.updateMany)).not.toHaveBeenCalled();
  });
});

// ── 乐观锁冲突 ────────────────────────────────────────────

describe("POST /api/advance-quarter — 乐观锁冲突", () => {
  it("updateMany 返回 0 条时返回 409", async () => {
    mockAuth(fakeCultivator);
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 0 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SEASON_CONFLICT");
  });
});

// ── 健康 ≤ 0 时的 injuryDebuff ────────────────────────────

describe("POST /api/advance-quarter — 健康 ≤ 0", () => {
  it("非跨年 health=0 时施加 injuryDebuff 且不恢复健康", async () => {
    mockAuth({ ...fakeCultivator, health: 0, injuryDebuff: 0, quarter: 1 });
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue({
      ...fakeCultivator,
      health: 0,
      injuryDebuff: 0,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.health).toBe(0);
    expect(updates.data.injuryDebuff).toBe(2); // HEALTH_ZERO_DEBUFF_DURATION
  });

  it("非跨年 health 为负值时同样施加 debuff", async () => {
    mockAuth({ ...fakeCultivator, health: -5, injuryDebuff: 1, quarter: 1 });
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue({
      ...fakeCultivator,
      health: -5,
      injuryDebuff: 1,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.health).toBe(-5);
    expect(updates.data.injuryDebuff).toBe(3);
  });

  it("跨年且原有 debuff>0 时按年递减（覆盖 zeroDebuff）", async () => {
    mockAuth({ ...fakeCultivator, quarter: 4, health: 0, injuryDebuff: 5 });
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue({
      ...fakeCultivator,
      quarter: 4,
      health: 0,
      injuryDebuff: 5,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.health).toBe(0);
    // zeroDebuff 被跨年递减逻辑覆盖：max(0, 5 - 1) = 4
    expect(updates.data.injuryDebuff).toBe(4);
  });

  it("跨年且原有 debuff=0 时叠加 zeroDebuff", async () => {
    mockAuth({ ...fakeCultivator, quarter: 4, health: 0, injuryDebuff: 0 });
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue({
      ...fakeCultivator,
      quarter: 4,
      health: 0,
      injuryDebuff: 0,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.health).toBe(0);
    expect(updates.data.injuryDebuff).toBe(2);
  });
});

// ── 零客户端 body 容错 ─────────────────────────────────────

describe("POST /api/advance-quarter — 空 body 容错", () => {
  it("json 解析抛出 SyntaxError 时仍正常推进", async () => {
    mockAuth(fakeCultivator);
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue(fakeCultivator);

    const brokenRequest = {
      json: () => Promise.reject(new SyntaxError("无效的 JSON")),
      headers: new Map(),
    } as unknown as NextRequest;

    const res = await POST(brokenRequest);
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.quarter).toBe(2);
  });
});
