import { describe, it, expect, vi, beforeEach } from "vitest";

// hoisted 共享数据
const h = vi.hoisted(() => ({
  /** 模拟数据库中的旧家庭（赵文、林建国） */
  existingFamily: [
    {
      id: "old-1",
      relation: "父亲",
      name: "赵文",
      age: 35,
      alive: true,
      intimacy: 50,
      occupation: null,
    },
    {
      id: "old-2",
      relation: "母亲",
      name: "林建国",
      age: 32,
      alive: true,
      intimacy: 50,
      occupation: null,
    },
  ],
  cultivator: {
    id: "c1",
    userId: "user1",
    name: "陈念安",
    realm: "炼气期",
    realmLevel: 3,
    gold: 100,
    stamina: 80,
    cultivationExp: 100,
    totalExp: 500,
    age: 1,
    worldId: "earth",
    title: null,
    breakthroughCount: 0,
    location: "home",
    spiritualRoot: "杂灵根",
    inventory: "[]",
    attributes: "{}",
    unlockedLocations: null,
    toxicity: 0,
    maxAge: 100,
    bonusAge: 0,
    reincarnationCount: 0,
    talents: null,
    inheritedTalent: null,
    inheritedItems: null,
    injuryDebuff: 0,
    mindDemon: 0,
    furnaceEquipped: null,
    health: 100,
    properties: null,
    unlockedFormulas: null,
    occupation: null,
    gender: null,
    schoolRank: 0,
    storySummaryUpdatedAt: null,
    storyEntries: null,
    storyEntriesUpdatedAt: null,
    breakthroughBuff: 0,
    npcRelations: null,
    attributeExp: "{}",
    subjectExp: "{}",
    physique: null,
    fate: null,
    talentSlots: null,
    worldYear: 2055,
  },
  /** 出生叙事返回的新家庭（陈建国、刘秀梅） */
  birthNarrative: {
    type: "BIRTH",
    title: "麟儿降世",
    narrative: "寒冬腊月，父亲陈建国在产房外焦急等待，母亲刘秀梅躺在床上。给孩子取名陈念安。",
    mood: "奇",
    hint: "瑞气东来",
    summary: "新生儿诞生在普通人家。",
    suggestedName: "陈念安",
    family: [
      { relation: "父亲", name: "陈建国", age: 28, alive: true, occupation: "教师" },
      { relation: "母亲", name: "刘秀梅", age: 26, alive: true, occupation: "家庭主妇" },
    ],
  },
}));

/** 记录对 mock DB 的调用：deleteMany 和 createMany 的参数 */
const dbCalls: { action: string; data?: unknown; count?: number }[] = [];
const careerInitializeCalls: Array<Record<string, unknown>> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(() => ({ id: "user1", cultivator: h.cultivator })) },
    cultivator: {
      findUnique: vi.fn(() => h.cultivator),
      update: vi.fn(() => ({ id: "c1", name: "陈念安" })),
    },
    gameEvent: { create: vi.fn(() => ({ id: "evt1" })), update: vi.fn(() => ({ id: "evt1" })) },
    narrativeEvent: { create: vi.fn(() => ({ id: "nevt1" })) },
    cultivatorTechnique: { findMany: vi.fn(() => []) },
    familyMember: {
      findMany: vi.fn(() => h.existingFamily), // 模拟 DB 中已有旧家庭
      createMany: vi.fn((data: any) => {
        dbCalls.push({ action: "createMany", data, count: data.data?.length || 0 });
        return Promise.resolve({ count: data.data?.length || 0 });
      }),
      deleteMany: vi.fn((where: any) => {
        dbCalls.push({ action: "deleteMany", count: h.existingFamily.length });
        return Promise.resolve({ count: h.existingFamily.length });
      }),
    },
    $transaction: vi.fn((tx: any) => {
      if (typeof tx === "function") {
        return tx({
          cultivator: {
            update: vi.fn(() => ({ id: "c1", name: "陈念安" })),
          },
          gameEvent: {
            create: vi.fn(() => ({ id: "evt1" })),
          },
          familyMember: {
            createMany: vi.fn((data: any) => {
              dbCalls.push({ action: "createMany", data, count: data.data?.length || 0 });
              return Promise.resolve({ count: data.data?.length || 0 });
            }),
            deleteMany: vi.fn((where: any) => {
              dbCalls.push({ action: "deleteMany", count: h.existingFamily.length });
              return Promise.resolve({ count: h.existingFamily.length });
            }),
          },
        });
      }
      return tx;
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: vi.fn(() => ({ cultivator: h.cultivator })),
  apiError: vi.fn(
    (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status })
  ),
}));

vi.mock("@/lib/narrative-stream", () => ({
  streamNarrativeResult: vi.fn(
    () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "text/event-stream" },
      })
  ),
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

vi.mock("@/lib/narrative", () => ({
  generateBirthNarrative: vi.fn(() => h.birthNarrative),
  generateDailyCultivationNarrative: vi.fn(() => ({ type: "DAILY_CULTIVATION" })),
  generateBreakthroughNarrative: vi.fn(() => ({ type: "BREAKTHROUGH" })),
  generateEncounterNarrative: vi.fn(() => ({ type: "ENCOUNTER" })),
  NarrativeError: class NarrativeError extends Error {
    code: string;
    constructor(m: string, code = "E") {
      super(m);
      this.code = code;
    }
  },
  createEntry: vi.fn(() => ({ id: "entry-1", title: "t", narrative: "n", important: true })),
  buildSummaryFromEntries: vi.fn(() => "概要"),
  compressStorySummary: vi.fn(() => "压缩概要"),
  buildSystemPrompt: vi.fn(() => "系统提示"),
  buildBirthPrompt: vi.fn(() => "出生提示"),
}));

import { requireCultivator } from "@/lib/auth-helpers";
const mockRequire = vi.mocked(requireCultivator);

function makeRequest(body: Record<string, unknown>) {
  return new Request(new URL("http://test/api/narrative"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

import { POST } from "../route";

describe("BIRTH 家庭替换：旧家庭成员被完整替换", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.length = 0;
    careerInitializeCalls.length = 0;
    mockRequire.mockResolvedValue({ cultivator: h.cultivator });
  });

  it("旧家庭（赵文、林建国）被删除，新家庭（陈建国、刘秀梅）被写入", async () => {
    const res = await POST(
      makeRequest({
        userId: "user1",
        type: "BIRTH",
        worldName: "地球",
        identityName: "书香门第",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    // 1) 验证 API 返回的新家庭
    expect(body.family).toBeDefined();
    expect(body.family.length).toBe(2);
    expect(body.family[0].name).toBe("陈建国");
    expect(body.family[1].name).toBe("刘秀梅");

    // 2) 验证事务内先调用 deleteMany
    const deleteActions = dbCalls.filter((c) => c.action === "deleteMany");
    expect(deleteActions.length).toBeGreaterThanOrEqual(1);

    // 3) 验证事务内调用 createMany
    const createActions = dbCalls.filter((c) => c.action === "createMany");
    expect(createActions.length).toBeGreaterThanOrEqual(1);

    // 4) 验证传递给 createMany 的数据是陈建国、刘秀梅，不是赵文、林建国
    const createData = createActions[0]?.data;
    if (createData?.data) {
      const names = createData.data.map((m: any) => m.name);
      expect(names).not.toContain("赵文");
      expect(names).not.toContain("林建国");
      expect(names).toContain("陈建国");
      expect(names).toContain("刘秀梅");
    }

    // 5) 验证返回的家庭来自落库数据（与叙事一致）
    expect(body.family[0].relation).toBe("父亲");
    expect(body.family[0].relation).toBe(h.birthNarrative.family[0].relation);
    expect(body.family[1].relation).toBe("母亲");
    expect(body.narrative?.suggestedName || body.suggestedName).toBe("陈念安");
  });

  it("AI occupation 与 birthTier 均不改变固定家庭成员的持久化职业和收入", async () => {
    const writeFor = async (birthTier: string, occupation: string) => {
      dbCalls.length = 0;
      careerInitializeCalls.length = 0;
      h.birthNarrative.family[0].occupation = occupation;
      const res = await POST(makeRequest({ type: "BIRTH", birthTier }));
      expect(res.status).toBe(200);
      const create = dbCalls.find((call) => call.action === "createMany");
      const member = (
        create?.data as {
          data: Array<{
            name: string;
            occupation: string;
            careerCategory: string;
            careerLevel: number;
            monthlyIncome: number;
            incomeLevel: number;
          }>;
        }
      ).data.find((item) => item.name === "陈建国");
      expect(member).toBeDefined();
      expect(careerInitializeCalls[0]).toMatchObject({
        relation: "父亲",
        worldYear: h.cultivator.worldYear,
        familyBackground: 2,
      });
      expect(careerInitializeCalls[0]).not.toHaveProperty("categoryHint");
      return member!;
    };

    const teacherFromPoorBirth = await writeFor("贫寒", "教师");
    const merchantFromWealthyBirth = await writeFor("显赫世家", "富商");

    expect(merchantFromWealthyBirth).toEqual(teacherFromPoorBirth);
  });

  it("API 不返回旧家庭中的姓名", async () => {
    const res = await POST(
      makeRequest({
        userId: "user1",
        type: "BIRTH",
        worldName: "地球",
        identityName: "书香门第",
      })
    );
    const body = await res.json();

    // 所有返回的 family 成员姓名都不能是赵文或林建国
    for (const member of body.family || []) {
      expect(member.name).not.toBe("赵文");
      expect(member.name).not.toBe("林建国");
    }
  });

  it("suggestedName 与叙事中一致", async () => {
    const res = await POST(
      makeRequest({
        userId: "user1",
        type: "BIRTH",
        worldName: "地球",
        identityName: "书香门第",
      })
    );
    const body = await res.json();
    expect(body.suggestedName).toBe("陈念安");
    expect(body.cultivator?.name).toBe("陈念安");
  });
});
