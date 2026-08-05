import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../../api/advance-quarter/route";
import { decayToxicity, DETOX_PER_QUARTER } from "@/lib/quarter-effects";

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
  attributes: '{"root":5,"spirit":3,"insight":4,"luck":2,"charm":3,"mind":3}',
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
    worldEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

// ── Pure function tests ────────────────────────────────────

describe("decayToxicity", () => {
  it("应减少 DETOX_PER_QUARTER（3）", () => {
    expect(decayToxicity(10)).toBe(7);
  });

  it("不应低于 0", () => {
    expect(decayToxicity(1)).toBe(0);
    expect(decayToxicity(0)).toBe(0);
  });

  it("当毒值为 0 时，结果为 0", () => {
    expect(decayToxicity(0)).toBe(0);
  });

  it("DETOX_PER_QUARTER 应为 3", () => {
    expect(DETOX_PER_QUARTER).toBe(3);
  });
});

// ── Auth / error tests ─────────────────────────────────────

describe("POST /api/advance-quarter — 鉴权", () => {
  it("requireCultivator 失败时返回错误", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({
      error: NextResponse.json({ error: "未登录" }, { status: 401 }),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });
});

describe("POST /api/advance-quarter — 非法季度", () => {
  it("quarter 为 0 时返回 400", async () => {
    mockAuth({ ...fakeCultivator, quarter: 0 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_QUARTER");
  });

  it("quarter > 4 时返回 400", async () => {
    mockAuth({ ...fakeCultivator, quarter: 5 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });
});

// ── Quarter advance tests ──────────────────────────────────

describe("POST /api/advance-quarter — 季度推进", () => {
  function setupOk(cultivator: any = fakeCultivator) {
    mockAuth(cultivator);
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue(cultivator);
  }

  it("1→2 正常推进", async () => {
    setupOk();
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.quarter).toBe(2);
    expect(updates.where.quarter).toBe(1);
  });

  it("2→3 正常推进", async () => {
    setupOk({ ...fakeCultivator, quarter: 2 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.quarter).toBe(3);
  });

  it("3→4 正常推进", async () => {
    setupOk({ ...fakeCultivator, quarter: 3 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.quarter).toBe(4);
  });

  it("4→1 跨年（年龄与世界年份均 +1）", async () => {
    setupOk({ ...fakeCultivator, quarter: 4, age: 8, worldYear: 2025 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.yearWrapped).toBe(true);
    expect(body.newAge).toBe(9);
    expect(body.worldYear).toBe(2026);
    expect(body.era).toMatchObject({ key: "contemporary" });
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.worldYear).toBe(2026);
  });

  it("普通季度保持世界年份不变", async () => {
    setupOk({ ...fakeCultivator, quarter: 2, worldYear: 2039 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.worldYear).toBe(2039);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.worldYear).toBeUndefined();
  });

  // ── 体力回满专项测试 ─────────────────────────────────

  it("低体力推进普通季度后体力回满", async () => {
    // calculateMaxStamina(8) = round(11 + (2/6)*7) = 13
    // stamina 从 10 回满到 13
    setupOk({ ...fakeCultivator, stamina: 10 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.stamina).toBe(13);
  });

  it("原本已满时仍保持上限", async () => {
    // stamina=13, 回满后仍为 13
    setupOk({ ...fakeCultivator, stamina: 13 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.stamina).toBe(13);
  });

  it("当前体力异常高于上限时归一到上限", async () => {
    // stamina=999 > maxStamina=13, 回满后归一到 13
    setupOk({ ...fakeCultivator, stamina: 999 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.stamina).toBe(13);
  });

  it("丹毒每季衰减 3", async () => {
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
});

// ── 跨年业务逻辑 ──────────────────────────────────────────

describe("POST /api/advance-quarter — 跨年", () => {
  function setupWrap(cultivator: any) {
    mockAuth(cultivator);
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue(cultivator);
  }

  it("属性增长持久化", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, age: 8 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(typeof updates.data.attributes).toBe("string");
    expect(updates.data.occupation).toBeTruthy();
    expect(updates.data.schoolRank).not.toBeUndefined();
  });

  it("旧职业字段为空时归一化、演进并返回可展示变化", async () => {
    const father = {
      id: "father-1",
      relation: "父亲",
      name: "张父",
      age: 40,
      alive: true,
      intimacy: 60,
      careerCategory: null,
      careerLevel: 0,
      careerStatus: "employed",
      monthlyIncome: 0,
      incomeLevel: null,
      careerUpdatedYear: null,
    };
    vi.mocked(prisma.familyMember.findMany).mockResolvedValueOnce([father]);
    vi.mocked(prisma.familyMember.update).mockResolvedValue({ ...father });
    setupWrap({ ...fakeCultivator, quarter: 4, age: 8, worldYear: 2025 });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.familyMember.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "father-1" },
        data: expect.objectContaining({
          careerCategory: expect.any(String),
          careerUpdatedYear: 2026,
        }),
      })
    );
    const body = await res.json();
    expect(body.familyCareerChanges).toEqual(
      expect.arrayContaining([expect.objectContaining({ relation: "父亲", name: "张父" })])
    );
    expect(JSON.stringify(body.familyCareerChanges)).not.toContain("seed");
  });

  it("家庭职业读取失败时返回可观测错误而不推进跨年状态", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, age: 8 });
    vi.mocked(prisma.familyMember.findMany).mockRejectedValueOnce(
      new Error("family database unavailable")
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "FAMILY_CAREER_SETTLEMENT_FAILED" });
    expect(vi.mocked(prisma.cultivator.updateMany)).not.toHaveBeenCalled();
  });

  it("家庭职业持久化失败时返回相同的可观测错误而不继续提交", async () => {
    const father = {
      id: "father-1",
      relation: "父亲",
      name: "张父",
      age: 40,
      alive: true,
      intimacy: 60,
      careerCategory: null,
      careerLevel: 0,
      careerStatus: "employed",
      monthlyIncome: 0,
      incomeLevel: null,
      careerUpdatedYear: null,
    };
    setupWrap({ ...fakeCultivator, quarter: 4, age: 8 });
    vi.mocked(prisma.familyMember.findMany).mockResolvedValueOnce([father]);
    vi.mocked(prisma.familyMember.update).mockRejectedValueOnce(
      new Error("family update unavailable")
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "FAMILY_CAREER_SETTLEMENT_FAILED" });
  });

  it("schoolRank 从 Int 转换并持久化", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, age: 8, schoolRank: 1 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.schoolRank).toBe(1);
  });

  it("4→1 跨年后按新年龄和新属性体力上限回满", async () => {
    // 跨年后 newAge=9, newAttributes 由 yearGrowth 决定
    // stamina 应设为 calculateMaxStamina(9, newAttributes) > 10
    setupWrap({ ...fakeCultivator, quarter: 4, age: 8, stamina: 10 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.stamina as number).toBeGreaterThan(10);
  });

  it("道消时季度、年龄和体力均不改变", async () => {
    // 寿元超限返回 daoXiao=true，不执行 updateMany
    const old = { ...fakeCultivator, quarter: 4, age: 100, stamina: 50 };
    setupWrap(old);
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.daoXiao).toBe(true);
    expect(vi.mocked(prisma.cultivator.updateMany)).not.toHaveBeenCalled();
  });

  it("重伤 debuff 按年递减", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, injuryDebuff: 5 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
    expect(updates.data.injuryDebuff).toBe(4);
  });

  it("寿元超限时返回道消", async () => {
    const old = { ...fakeCultivator, quarter: 4, age: 100 };
    setupWrap(old);
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.daoXiao).toBe(true);
  });

  it("16 岁触发灵气觉醒", async () => {
    setupWrap({ ...fakeCultivator, quarter: 4, age: 15 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.awakenEvent).toBeTruthy();
    expect(body.awakenEvent.title).toContain("觉醒");
  });

  it("连续四次成功推进，每次回满而非累积", async () => {
    let current: any = { ...fakeCultivator, quarter: 1, stamina: 10, age: 8 };
    for (let q = 1; q <= 4; q++) {
      vi.mocked(requireCultivator).mockReset();
      vi.mocked(requireCultivator).mockResolvedValueOnce({
        cultivator: { ...current, user: { id: "u1", name: "测试用户" } },
      });
      vi.mocked(prisma.cultivator.updateMany).mockReset().mockResolvedValue({ count: 1 });
      vi.mocked(prisma.cultivator.findUnique).mockReset().mockResolvedValue(current);

      const res = await POST(makeRequest());
      expect(res.status).toBe(200);
      const updates = vi.mocked(prisma.cultivator.updateMany).mock.calls[0][0];
      // 每次回满到当前上限，不累积叠加（age 8 时上限约 13~16）
      expect(updates.data.stamina as number).toBeGreaterThan(10);

      current = { ...current, quarter: q >= 4 ? 1 : q + 1, stamina: 10 };
      if (q === 4) current = { ...current, age: 9 };
    }
  });
});

// ── 乐观锁并发测试 ────────────────────────────────────────

describe("POST /api/advance-quarter — 并发保护", () => {
  it("updateMany 返回 0 条时返回 409", async () => {
    mockAuth(fakeCultivator);
    vi.mocked(prisma.cultivator.updateMany).mockResolvedValue({ count: 0 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SEASON_CONFLICT");
  });

  it("并发请求：第二个请求应失败", async () => {
    mockAuth(fakeCultivator);
    mockAuth(fakeCultivator);
    vi.mocked(prisma.cultivator.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    vi.mocked(prisma.cultivator.findUnique).mockResolvedValue(fakeCultivator);

    const [r1, r2] = await Promise.all([POST(makeRequest()), POST(makeRequest())]);
    const succeeded = r1.status === 200 ? r1 : r2;
    const conflicted = r1.status === 409 ? r1 : r2;
    expect(succeeded.status).toBe(200);
    expect(conflicted.status).toBe(409);
  });
});
