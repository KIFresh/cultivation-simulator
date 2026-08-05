import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  familyMember: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockAuth = vi.hoisted(() => ({
  requireCultivator: vi.fn(),
  apiError: vi.fn(
    (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status })
  ),
}));

vi.mock("@/lib/auth-helpers", () => mockAuth);

// ── Helpers ──────────────────────────────────────────────────

function makeGetRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

function makePostRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

const makeCultivator = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  userId: "u1",
  name: "测试",
  stamina: 20,
  realm: "炼气期",
  realmLevel: 1,
  gold: 50,
  worldId: "earth",
  worldYear: 2025,
  age: 18,
  location: "home",
  attributes: null,
  inventory: "[]",
  npcRelations: null,
  storyEntries: "[]",
  storyEntriesUpdatedAt: null,
  talents: null,
  spiritualRoot: "火灵根",
  title: null,
  maxAge: null,
  bonusAge: 0,
  breakthroughCount: 0,
  breakthroughBuff: 0,
  reincarnationCount: 0,
  injuryDebuff: 0,
  mindDemon: 0,
  occupation: null,
  schoolRank: 0,
  unlockedLocations: null,
  unlockedFormulas: null,
  toxicity: 0,
  furnaceEquipped: null,
  cultivationExp: 100,
  totalExp: 200,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────

describe("GET /api/family", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.requireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
  });

  it("缺少 userId 时返回 401", async () => {
    const res = await GET(makeGetRequest("http://localhost/api/family"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("缺少用户标识");
  });

  it("返回家庭成员列表", async () => {
    const fakeMembers = [
      {
        id: "m1",
        cultivatorId: "c1",
        relation: "父亲",
        name: "张三",
        age: 45,
        alive: true,
        intimacy: 50,
        dialogueHistory: "[]",
      },
      {
        id: "m2",
        cultivatorId: "c1",
        relation: "母亲",
        name: "李四",
        age: 42,
        alive: true,
        intimacy: 55,
        dialogueHistory: "[]",
      },
    ];
    mockPrisma.familyMember.findMany.mockResolvedValue(fakeMembers);

    const res = await GET(makeGetRequest("http://localhost/api/family?userId=u1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.members).toHaveLength(2);
    expect(data.members[0].relation).toBe("父亲");
    expect(data.members[1].relation).toBe("母亲");
  });

  it("解析 dialogueHistory JSON", async () => {
    const fakeMembers = [
      {
        id: "m1",
        cultivatorId: "c1",
        relation: "父亲",
        name: "张三",
        age: 45,
        alive: true,
        intimacy: 50,
        dialogueHistory: '[{"role":"player","content":"你好","timestamp":100}]',
      },
    ];
    mockPrisma.familyMember.findMany.mockResolvedValue(fakeMembers);

    const res = await GET(makeGetRequest("http://localhost/api/family?userId=u1"));
    const data = await res.json();
    expect(data.members[0].dialogueHistory).toEqual([
      { role: "player", content: "你好", timestamp: 100 },
    ]);
  });

  it("cultivatorId 不匹配时返回 403", async () => {
    const res = await GET(
      makeGetRequest("http://localhost/api/family?userId=u1&cultivatorId=wrong-id")
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("无权访问");
  });

  it("auth 失败时返回错误", async () => {
    mockAuth.requireCultivator.mockResolvedValue({
      error: mockAuth.apiError("无效的用户 ID", 400),
    });

    const res = await GET(makeGetRequest("http://localhost/api/family?userId=invalid"));
    expect(res.status).toBe(400);
  });

  it("按 relation 排序", async () => {
    const fakeMembers = [
      {
        id: "m1",
        cultivatorId: "c1",
        relation: "母亲",
        name: "李四",
        age: 42,
        alive: true,
        intimacy: 55,
        dialogueHistory: "[]",
      },
      {
        id: "m2",
        cultivatorId: "c1",
        relation: "父亲",
        name: "张三",
        age: 45,
        alive: true,
        intimacy: 50,
        dialogueHistory: "[]",
      },
    ];
    mockPrisma.familyMember.findMany.mockResolvedValue(fakeMembers);

    await GET(makeGetRequest("http://localhost/api/family?userId=u1"));
    expect(mockPrisma.familyMember.findMany).toHaveBeenCalledWith({
      where: { cultivatorId: "c1" },
      orderBy: { relation: "asc" },
    });
  });

  it("查询失败时返回 500", async () => {
    mockPrisma.familyMember.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeGetRequest("http://localhost/api/family?userId=u1"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/family", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.requireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
    mockPrisma.familyMember.findMany.mockResolvedValue([]);
    mockPrisma.familyMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.familyMember.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma)
    );
  });

  it("缺少 userId 时返回 401", async () => {
    const res = await POST(makePostRequest({ members: [] }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("缺少用户标识");
  });

  it("缺少 members 时返回 400", async () => {
    const res = await POST(makePostRequest({ userId: "u1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("缺少家庭成员数据");
  });

  it("members 为空数组时返回 400", async () => {
    const res = await POST(makePostRequest({ userId: "u1", members: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("缺少家庭成员数据");
  });

  it("批量创建家庭成员成功", async () => {
    const members = [
      { relation: "父亲", name: "张三", age: 45, alive: true, intimacy: 50 },
      { relation: "母亲", name: "李四", age: 42 },
    ];
    const res = await POST(makePostRequest({ userId: "u1", members }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
  });

  it("忽略客户端对已有成员 relation 和 alive 的修改", async () => {
    const existing = {
      id: "m1",
      cultivatorId: "c1",
      relation: "父亲",
      name: "张三",
      age: 45,
      alive: true,
      intimacy: 50,
      occupation: "资深教师",
      incomeLevel: 3,
      careerCategory: "education",
      careerLevel: 3,
      careerStatus: "employed",
      monthlyIncome: 12345,
      careerUpdatedYear: 2032,
    };
    mockPrisma.familyMember.findMany.mockResolvedValue([existing]);

    await POST(
      makePostRequest({
        userId: "u1",
        members: [{ id: "m1", relation: "仇人", name: "张三", age: 1, alive: false, intimacy: 0 }],
      })
    );

    expect(mockPrisma.familyMember.createMany).toHaveBeenCalledWith({ data: [existing] });
  });

  it("成功保存已有成员时写入服务端职业快照", async () => {
    const existing = {
      id: "m1",
      cultivatorId: "c1",
      relation: "父亲",
      name: "张三",
      age: 45,
      alive: true,
      intimacy: 50,
      occupation: "资深教师",
      incomeLevel: 3,
      careerCategory: "education",
      careerLevel: 3,
      careerStatus: "employed",
      monthlyIncome: 12345,
      careerUpdatedYear: 2032,
    };
    mockPrisma.familyMember.findMany.mockResolvedValue([existing]);

    const res = await POST(
      makePostRequest({
        userId: "u1",
        members: [{ id: "m1", relation: "父亲", name: "张三" }],
      })
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.familyMember.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          occupation: "资深教师",
          incomeLevel: 3,
          careerCategory: "education",
          careerLevel: 3,
          careerStatus: "employed",
          monthlyIncome: 12345,
          careerUpdatedYear: 2032,
        }),
      ],
    });
  });

  it("忽略客户端为新增成员注入的受管及职业字段", async () => {
    const members = [
      {
        relation: "弟弟",
        name: "张小",
        age: 10,
        alive: false,
        intimacy: 0,
        occupation: "首席执行官",
        incomeLevel: 4,
        careerCategory: "business",
        careerLevel: 4,
        careerStatus: "employed",
        monthlyIncome: 999999,
        careerUpdatedYear: 9999,
      },
    ];

    await POST(makePostRequest({ userId: "u1", members }));

    expect(mockPrisma.familyMember.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          alive: true,
          intimacy: 50,
          careerCategory: expect.any(String),
          careerLevel: expect.any(Number),
          careerStatus: "unemployed",
          monthlyIncome: 0,
          incomeLevel: 0,
          careerUpdatedYear: expect.any(Number),
        }),
      ],
    });
    const created = mockPrisma.familyMember.createMany.mock.calls[0][0].data[0];
    expect(created).not.toMatchObject({
      alive: false,
      intimacy: 0,
      occupation: "首席执行官",
      incomeLevel: 4,
      careerCategory: "business",
      careerLevel: 4,
      careerStatus: "employed",
      monthlyIncome: 999999,
      careerUpdatedYear: 9999,
    });
  });

  it("未提供 alive/intimacy 时使用默认值", async () => {
    const members = [{ relation: "弟弟", name: "张小", age: 10 }];
    await POST(makePostRequest({ userId: "u1", members }));

    expect(mockPrisma.familyMember.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ alive: true, intimacy: 50 })],
    });
  });

  it("auth 失败时返回错误", async () => {
    mockAuth.requireCultivator.mockResolvedValue({
      error: mockAuth.apiError("无效的用户 ID", 400),
    });

    const res = await POST(
      makePostRequest({
        userId: "invalid",
        members: [{ relation: "父亲", name: "张三", age: 45 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("createMany 失败时事务不会清空已有成员", async () => {
    const existing = {
      id: "m1",
      cultivatorId: "c1",
      relation: "父亲",
      name: "张三",
      age: 45,
      alive: true,
      intimacy: 50,
      occupation: "教师",
      incomeLevel: 2,
      careerCategory: "education",
      careerLevel: 2,
      careerStatus: "employed",
      monthlyIncome: 5000,
      careerUpdatedYear: 2025,
    };
    let persistedMembers = [existing];
    mockPrisma.familyMember.findMany.mockResolvedValue(persistedMembers);
    mockPrisma.familyMember.deleteMany.mockImplementation(async () => {
      persistedMembers = [];
      return { count: 1 };
    });
    mockPrisma.familyMember.createMany.mockRejectedValue(new Error("DB error"));
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const beforeTransaction = persistedMembers;
        try {
          return await callback(mockPrisma);
        } catch (error) {
          persistedMembers = beforeTransaction;
          throw error;
        }
      }
    );

    const res = await POST(
      makePostRequest({
        userId: "u1",
        members: [{ id: "m1", relation: "父亲", name: "张三" }],
      })
    );

    expect(res.status).toBe(500);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(persistedMembers).toEqual([existing]);
  });
});
