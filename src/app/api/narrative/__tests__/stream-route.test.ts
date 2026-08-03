import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

// 用 vi.hoisted 提供共享 cultivator，避免 vi.mock 工厂闭包引用未初始化 const（TDZ）
const h = vi.hoisted(() => ({
  cultivator: {
    id: "c1",
    userId: "user1",
    name: "测试者",
    realm: "炼气期",
    realmLevel: 3,
    gold: 100,
    stamina: 80,
    cultivationExp: 100,
    totalExp: 500,
    age: 16,
    worldId: "earth",
    title: null,
    breakthroughCount: 0,
    location: "home",
    spiritualRoot: "杂灵根",
    inventory: "[]",
    attributes: "{}",
    unlockedLocations: null,
    toxicity: 0,
    maxAge: null,
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
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(() => ({ id: "user1", cultivator: h.cultivator })) },
    cultivator: { findUnique: vi.fn(() => h.cultivator), update: vi.fn(() => ({ id: "c1" })) },
    gameEvent: { create: vi.fn(() => ({ id: "evt1" })), update: vi.fn(() => ({ id: "evt1" })) },
    narrativeEvent: { create: vi.fn(() => ({ id: "nevt1" })) },
    cultivatorTechnique: { findMany: vi.fn(() => []) },
    familyMember: { findMany: vi.fn(() => []) },
    // 数组形式 $transaction 用于 BREAKTHROUGH；函数形式用于 BIRTH
    $transaction: vi.fn((tx: any) => {
      if (Array.isArray(tx)) return Promise.resolve([null, { id: "evt1" }]);
      // 函数回调：提供 mock tx 对象
      return tx({
        cultivator: { update: vi.fn(() => ({ id: "c1" })) },
        gameEvent: { create: vi.fn(() => ({ id: "evt1" })) },
        familyMember: {
          createMany: vi.fn(() => Promise.resolve({ count: 2 })),
          deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
        },
      });
    }),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: vi.fn(() => ({ cultivator: h.cultivator })),
  apiError: vi.fn(
    (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status })
  ),
}));

// 捕获 createSSEResponse 的参数以验证流式契约（不真正产生 SSE 字节）
let captured: any = {};
vi.mock("@/lib/stream-helper", () => ({
  createSSEResponse: vi.fn((gen: any, onComplete: any, committed: any, onError: any) => {
    captured = { gen, onComplete, committed, onError, source: "createSSEResponse" };
    return new Response("event: done\ndata: {}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),
}));

vi.mock("@/lib/narrative-stream", () => ({
  streamNarrativeResult: vi.fn((_id: string, _n: any, _payload: any, _cultivator: any) => {
    captured = {
      onComplete: () => _payload,
      onError: () => ({ gameEventId: _id }),
      committed: { gameEventId: _id, cultivator: _cultivator },
      source: "streamNarrativeResult",
    };
    return new Response("event: done\ndata: {}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),
  streamAIJob: vi.fn((opts: { run: (onDelta: (t: string) => void) => Promise<{ result: unknown }> }) => {
    captured = { source: "streamAIJob", run: opts.run };
    return new Response("event: done\ndata: {}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),
}));

vi.mock("@/lib/narrative", () => ({
  generateDailyCultivationNarrative: vi.fn(() => ({
    type: "DAILY_CULTIVATION",
    title: "修炼",
    narrative: "今日修炼",
    mood: "静",
    hint: "继续",
    summary: "今日修炼总结",
  })),
  generateBreakthroughNarrative: vi.fn(() => ({
    type: "BREAKTHROUGH",
    title: "突破",
    narrative: "成功突破",
    mood: "燃",
    hint: "恭喜",
    summary: "突破总结",
  })),
  generateEncounterNarrative: vi.fn(() => ({
    type: "ENCOUNTER",
    title: "意外",
    narrative: "发现",
    mood: "奇",
    summary: "s",
    choices: [{ text: "探查", risk: "low", hint: "稳" }],
  })),
  generateBirthNarrative: vi.fn(() => ({
    type: "BIRTH",
    title: "出世",
    narrative: "降生",
    mood: "奇",
    summary: "s",
    suggestedName: "李逍遥",
  })),
  NarrativeError: class NarrativeError extends Error {
    code: string;
    constructor(m: string, code = "E") {
      super(m);
      this.code = code;
    }
  },
  callAIStream: vi.fn(async function* () {
    yield "天地";
    yield "灵机";
  }),
  callAI: vi.fn(),
  extractJson: vi.fn((_t: string, fallback: any) => ({ ...fallback, goldChange: 0 })),
  createEntry: vi.fn(() => ({ id: "entry-1", title: "t", narrative: "n", important: false })),
  buildSummaryFromEntries: vi.fn(() => "概要"),
  compressStorySummary: vi.fn(() => "压缩概要"),
  buildSystemPrompt: vi.fn(() => "系统提示"),
  buildDailyCultivationPrompt: vi.fn(() => "用户提示"),
  buildBreakthroughPrompt: vi.fn(() => "用户提示"),
  buildEncounterPrompt: vi.fn(() => "用户提示"),
  buildBirthPrompt: vi.fn(() => "用户提示"),
  stateFromCultivator: vi.fn((c: any) => ({
    name: c.name,
    age: c.age,
    realm: c.realm || "凡人",
    realmLevel: c.realmLevel ?? 0,
    gold: c.gold ?? 0,
    stamina: c.stamina ?? 100,
    locationId: c.location || "home",
    attributes: c.attributes ?? {},
  })),
}));

import { requireCultivator } from "@/lib/auth-helpers";
const mockRequire = vi.mocked(requireCultivator);

const baseCultivator = h.cultivator;

function makeStreamRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL("http://test/api/narrative?stream=true"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * 验证叙事路由 ?stream=true 的「提交优先 + 可重试」契约：
 * 每条流都在首个 chunk 前发出 committed（含 gameEventId 重试锚点）；
 * 流中断时 onError 回传同一 gameEventId；done 回调返回叙事结果用于回填。
 */
describe("Narrative API 流式契约（提交优先 + 可重试）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured = {};
    mockRequire.mockResolvedValue({ cultivator: baseCultivator });
  });

  it("DAILY_CULTIVATION：走 AI 真流式（streamAIJob，无 committed）", async () => {
    const res = await POST(makeStreamRequest({ userId: "user1", type: "DAILY_CULTIVATION" }));
    expect(res.headers.get("Content-Type")).toContain("event-stream");
    expect(captured.source).toBe("streamAIJob");
    // run 执行 AI（mock 返回 narrative），done 载荷含叙事结果
    const { result } = await captured.run(() => {});
    expect(result.narrative.narrative).toBe("今日修炼");
  });

  it("BREAKTHROUGH：committed 含 gameEventId 与乐观 cultivator", async () => {
    const res = await POST(makeStreamRequest({ userId: "user1", type: "BREAKTHROUGH" }));
    expect(res.headers.get("Content-Type")).toContain("event-stream");
    expect(captured.committed.gameEventId).toBeDefined();
    expect(captured.committed.cultivator).toBeDefined();
  });

  it("ENCOUNTER：committed 含 gameEventId", async () => {
    const res = await POST(makeStreamRequest({ userId: "user1", type: "ENCOUNTER" }));
    expect(res.headers.get("Content-Type")).toContain("event-stream");
    expect(captured.committed.gameEventId).toBeDefined();
  });

  it("BIRTH：committed 含 gameEventId", async () => {
    const res = await POST(
      makeStreamRequest({
        userId: "user1",
        type: "BIRTH",
        worldName: "地球",
        identityName: "书香门第",
        worldId: "earth",
      })
    );
    expect(res.headers.get("Content-Type")).toContain("event-stream");
    expect(captured.committed.gameEventId).toBeDefined();
  });

  it("done 载荷来自 AI 生成结果（streamAIJob.run 返回叙事）", async () => {
    await POST(makeStreamRequest({ userId: "user1", type: "DAILY_CULTIVATION" }));
    expect(captured.source).toBe("streamAIJob");
    const { result } = await captured.run(() => {});
    expect(result.narrative).toBeDefined();
  });
});
