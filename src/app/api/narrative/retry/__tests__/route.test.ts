import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const mockPrisma = vi.hoisted(() => ({
  cultivator: { update: vi.fn() },
  gameEvent: { update: vi.fn() },
  familyMember: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));

const mockRequireCultivator = vi.hoisted(() => vi.fn());
const mockGenerateBirthNarrative = vi.hoisted(() => vi.fn());
const careerInitializeCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: mockRequireCultivator,
}));
vi.mock("@/lib/narrative", () => ({
  generateBirthNarrative: mockGenerateBirthNarrative,
}));
vi.mock("@/lib/family-career", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family-career")>();
  return {
    ...actual,
    initializeFamilyCareer: vi.fn((input) => {
      careerInitializeCalls.push(input);
      return actual.initializeFamilyCareer(input);
    }),
  };
});

const makeCultivator = (overrides: any = {}) => ({
  id: "c1",
  userId: "u1",
  name: "测试",
  realm: "凡人",
  realmLevel: 0,
  spiritualRoot: "火灵根",
  stamina: 50,
  gold: 100,
  inventory: "[]",
  cultivationExp: 0,
  totalExp: 0,
  age: 18,
  location: "home",
  storyEntries: "[]",
  storyEntriesUpdatedAt: null,
  breakthroughCount: 0,
  breakthroughBuff: 0,
  reincarnationCount: 0,
  injuryDebuff: 0,
  mindDemon: 0,
  maxAge: null,
  bonusAge: 0,
  worldId: "earth",
  worldYear: 2055,
  talents: null,
  inheritedTalent: null,
  inheritedItems: null,
  attributes: null,
  ...overrides,
});

const makeRequest = (body: any): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

describe("Narrative Retry API - POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    careerInitializeCalls.length = 0;
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
    mockGenerateBirthNarrative.mockResolvedValue({
      title: "转世重生",
      narrative: "你重生了",
      mood: "奇",
      suggestedName: "小石头",
      family: [
        { relation: "父亲", name: "石父", age: 35, alive: true, occupation: "农夫", intimacy: 50 },
      ],
      summary: "转世故事",
    });
    mockPrisma.$transaction.mockImplementation(async (txn: any) => {
      return txn({
        cultivator: { update: vi.fn().mockResolvedValue({ ...makeCultivator() }) },
        gameEvent: { update: vi.fn().mockResolvedValue({ id: "evt1" }) },
        familyMember: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      });
    });
  });

  it("缺少叙事类型返回 400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("非 BIRTH 类型返回 400", async () => {
    const res = await POST(makeRequest({ type: "DAILY_CULTIVATION" }));
    expect(res.status).toBe(400);
  });

  it("成功重试 BIRTH 叙事", async () => {
    const res = await POST(makeRequest({ type: "BIRTH" }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.title).toBe("转世重生");
    expect(d.suggestedName).toBe("小石头");
    expect(d.cultivator.name).toBe("小石头");
  });

  it("重试时更新已存在的 gameEvent", async () => {
    const res = await POST(makeRequest({ type: "BIRTH", gameEventId: "evt1" }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.gameEventId).toBe("evt1");
  });

  it("重试时 AI occupation 与 birthTier 均不改变固定家庭成员的持久化职业和收入", async () => {
    const writesFor = async (birthTier: string, occupation: string) => {
      careerInitializeCalls.length = 0;
      mockGenerateBirthNarrative.mockResolvedValue({
        title: "转世重生",
        narrative: "你重生了",
        mood: "奇",
        suggestedName: "小石头",
        family: [
          { relation: "父亲", name: "石父", age: 35, alive: true, occupation, intimacy: 50 },
        ],
        summary: "转世故事",
      });
      const createMany = vi.fn().mockResolvedValue({ count: 1 });
      mockPrisma.$transaction.mockImplementationOnce(async (txn: any) =>
        txn({
          cultivator: { update: vi.fn().mockResolvedValue(makeCultivator()) },
          gameEvent: { update: vi.fn().mockResolvedValue({ id: "evt1" }) },
          familyMember: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany },
        })
      );

      const res = await POST(makeRequest({ type: "BIRTH", params: { birthTier } }));
      expect(res.status).toBe(200);
      const member = createMany.mock.calls[0][0].data[0];
      expect(careerInitializeCalls[0]).toMatchObject({
        relation: "父亲",
        worldYear: 2055,
        familyBackground: 2,
      });
      expect(careerInitializeCalls[0]).not.toHaveProperty("categoryHint");
      return member;
    };

    const farmerFromPoorBirth = await writesFor("贫寒", "农夫");
    const merchantFromWealthyBirth = await writesFor("显赫世家", "富商");

    expect(merchantFromWealthyBirth).toEqual(farmerFromPoorBirth);
  });

  it("suggestedName 无效时使用原名称", async () => {
    mockGenerateBirthNarrative.mockResolvedValue({
      title: "转世重生",
      narrative: "你重生了",
      mood: "奇",
      suggestedName: "",
      family: [],
      summary: "转世故事",
    });
    const res = await POST(makeRequest({ type: "BIRTH", params: { cultivatorName: "阿宝" } }));
    const d = await res.json();
    expect(d.suggestedName).toBe("阿宝");
  });

  it("未鉴权返回 401", async () => {
    mockRequireCultivator.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "AUTH" }), { status: 401 }),
    });
    const res = await POST(makeRequest({ type: "BIRTH" }));
    expect(res.status).toBe(401);
  });
});
