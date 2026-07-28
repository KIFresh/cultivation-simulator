import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeAction, type ActionResult } from "../action-service";

// ─── Hoisted mock factories ────────────────────────────────────────────────
const mockGetActionById = vi.hoisted(() => vi.fn());
const mockGenerateActionNarrative = vi.hoisted(() => vi.fn());
const mockCreateEntry = vi.hoisted(() => vi.fn());
const mockBuildSummaryFromEntries = vi.hoisted(() => vi.fn());
const mockCompressStorySummary = vi.hoisted(() => vi.fn());
const mockStateFromCultivator = vi.hoisted(() => vi.fn());
const mockSanitizeAttributes = vi.hoisted(() => vi.fn());
const mockResolveCombat = vi.hoisted(() => vi.fn());
const mockGetEnemiesForLocation = vi.hoisted(() => vi.fn());
const mockApplyEffects = vi.hoisted(() => vi.fn());
const mockClampEffectsArray = vi.hoisted(() => vi.fn((e: any[]) => e));
const mockCheckEffectWhitelist = vi.hoisted(() => vi.fn(() => []));
const mockGetGoldMaxGainByRealm = vi.hoisted(() => vi.fn(() => 50));
const mockCalculateActionExp = vi.hoisted(() => vi.fn(() => 30));
const mockCalculateMaxStamina = vi.hoisted(() => vi.fn(() => 100));
const mockCanBreakthrough = vi.hoisted(() => vi.fn(() => false));
const mockIsAwakened = vi.hoisted(() => vi.fn(() => true));
const mockGetLocationActionBonus = vi.hoisted(() => vi.fn(() => 1));
const mockCalculateTechniqueBonuses = vi.hoisted(() => vi.fn(() => ({})));
const mockAddProficiency = vi.hoisted(() => vi.fn());
const mockTriggerStudyEvent = vi.hoisted(() => vi.fn());
const mockGetDefaultStudyNarrative = vi.hoisted(() => vi.fn(() => "研读中"));

// ─── Module mocks ───────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cultivatorTechnique: { findMany: vi.fn() },
    gameEvent: { count: vi.fn(() => 0) },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib", () => ({
  getActionById: mockGetActionById,
  calculateActionExp: mockCalculateActionExp,
  canBreakthrough: mockCanBreakthrough,
  MORTAL_REALM: "凡人",
  isAwakened: mockIsAwakened,
  calculateMaxStamina: mockCalculateMaxStamina,
  getLocationActionBonus: mockGetLocationActionBonus,
  REALM_ORDER: ["凡人", "炼气期", "筑基期", "结丹期", "元婴期", "化神期"],
  isRealmSufficient: (realm: string, minRealm: string) => {
    const order = ["凡人", "炼气期", "筑基期", "结丹期", "元婴期", "化神期"];
    const idx = order.indexOf(realm);
    const minIdx = order.indexOf(minRealm);
    if (minIdx < 0) return true;
    if (idx < 0) return false;
    return idx >= minIdx;
  },
}));

vi.mock("@/lib/narrative", () => ({
  generateActionNarrative: mockGenerateActionNarrative,
  createEntry: mockCreateEntry,
  buildSummaryFromEntries: mockBuildSummaryFromEntries,
  compressStorySummary: mockCompressStorySummary,
  stateFromCultivator: mockStateFromCultivator,
}));

vi.mock("@/lib/utils", () => ({
  sanitizeAttributes: mockSanitizeAttributes,
}));

vi.mock("@/lib/combat-engine", () => ({
  resolveCombat: mockResolveCombat,
}));

vi.mock("@/lib/enemy-data", () => ({
  getEnemiesForLocation: mockGetEnemiesForLocation,
}));

vi.mock("@/lib/technique-data", () => ({
  TECHNIQUES: {
    qi_gathering: { name: "聚气诀", icon: "📜", upgradeProficiency: 100 },
    fire_art: { name: "炎火术", icon: "🔥", upgradeProficiency: 150 },
  },
  calculateTechniqueBonuses: mockCalculateTechniqueBonuses,
  calcTechniqueProficiency: vi.fn(() => 20),
  addProficiency: mockAddProficiency,
  triggerStudyEvent: mockTriggerStudyEvent,
  getDefaultStudyNarrative: mockGetDefaultStudyNarrative,
}));

vi.mock("@/lib/narrative-effects", () => ({
  applyEffects: mockApplyEffects,
  clampEffectsArray: mockClampEffectsArray,
}));

vi.mock("@/lib/narrative-schema", () => ({
  NARRATIVE_EFFECT_WHITELISTS: { ACTION: ["stamina", "gold"] },
  checkEffectWhitelist: mockCheckEffectWhitelist,
}));

vi.mock("@/lib/gold", () => ({
  getGoldMaxGainByRealm: mockGetGoldMaxGainByRealm,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAction(overrides: Partial<typeof DEFAULT_ACTION> = {}): any {
  return { ...DEFAULT_ACTION, ...overrides };
}

const DEFAULT_ACTION = {
  id: "MEDITATE",
  name: "打坐修炼",
  icon: "🧘",
  description: "盘膝而坐",
  actionPointCost: 5,
  baseExp: 30,
  category: "cultivate",
  minAgeEarth: 16,
  narrativeTag: "cultivate",
  minRealm: "炼气期",
};

const BASE_CULTIVATOR = {
  id: "c1",
  userId: "u1",
  name: "测试者",
  realm: "炼气期",
  realmLevel: 3,
  gold: 100,
  stamina: 80,
  cultivationExp: 100,
  totalExp: 500,
  age: 16,
  worldId: "earth",
  location: "home",
  spiritualRoot: "杂灵根",
  inventory: "[]",
  attributes: '{"root":10,"spirit":8,"insight":6,"luck":5,"charm":4,"mind":7}',
  talents: '["protagonist"]',
  storyEntries: "[]",
  storyEntriesUpdatedAt: null,
  injuryDebuff: 0,
  mindDemon: 0,
  breakthroughCount: 0,
  reincarnationCount: 0,
  maxAge: null,
  bonusAge: 0,
  toxicity: 0,
};

const DEFAULT_NARRATIVE = {
  type: "ACTION",
  title: "冥想",
  narrative: "你静心冥想，灵力有所提升。",
  mood: "静",
  hint: "继续",
  summary: "冥想结束",
};

const mockTx = () => ({
  cultivator: { update: vi.fn().mockResolvedValue({ ...BASE_CULTIVATOR, stamina: 75 }) },
  gameEvent: { create: vi.fn().mockResolvedValue({ id: "evt1" }) },
  cultivatorTechnique: { update: vi.fn().mockResolvedValue({}) },
});

beforeEach(() => {
  vi.clearAllMocks();

  mockGetActionById.mockImplementation((id: string) => {
  if (id === "EXPLORE") return makeAction({ id: "EXPLORE", name: "外出历练", category: "explore", actionPointCost: 8 });
  if (id === "STUDY") return makeAction({ id: "STUDY", name: "研读功法", category: "cultivate", minRealm: "筑基期" });
  if (id === "TALK") return makeAction({ id: "TALK", name: "与人交谈", category: "social", actionPointCost: 2, minAgeEarth: 1, minRealm: undefined });
  if (id === "WANDER") return makeAction({ id: "WANDER", name: "四处闲逛", category: "explore", actionPointCost: 2, minAgeEarth: 1, minRealm: undefined });
  return makeAction();
});
  mockGenerateActionNarrative.mockResolvedValue({ ...DEFAULT_NARRATIVE });
  mockCreateEntry.mockReturnValue({ title: "记忆", narrative: "内容", important: false });
  mockBuildSummaryFromEntries.mockReturnValue("概要");
  mockSanitizeAttributes.mockReturnValue({ root: 10, spirit: 8, insight: 6, luck: 5, charm: 4, mind: 7 });
  mockStateFromCultivator.mockReturnValue({ location: "home", age: 16, realm: "炼气期" });
  mockResolveCombat.mockResolvedValue(null);
  mockGetEnemiesForLocation.mockReturnValue([]);
  mockAddProficiency.mockReturnValue({ newLevel: 1, newProficiency: 10, leveledUp: false });
  mockTriggerStudyEvent.mockReturnValue(null);
  mockCalculateMaxStamina.mockReturnValue(100);
  mockCanBreakthrough.mockReturnValue(false);
  mockIsAwakened.mockReturnValue(true);
  mockGetLocationActionBonus.mockReturnValue(1);
  mockCalculateTechniqueBonuses.mockReturnValue({});
  mockCheckEffectWhitelist.mockReturnValue([]);
  mockGetGoldMaxGainByRealm.mockReturnValue(50);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("executeAction - 快速失败 (前置校验)", () => {
  it("无效 actionId 返回 error", async () => {
    mockGetActionById.mockReturnValue(undefined);
    const result = await executeAction({ actionId: "INVALID" }, BASE_CULTIVATOR);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBe("无效的行动类型");
      expect(result.code).toBe(400);
    }
  });

  it("行动力不足返回 error", async () => {
    const weak = { ...BASE_CULTIVATOR, stamina: 2 };
    const result = await executeAction({ actionId: "MEDITATE" }, weak);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBe("行动力不足");
      expect(result.code).toBe(400);
    }
  });

  it("地球年龄不足返回 error", async () => {
    const young = { ...BASE_CULTIVATOR, age: 10 };
    const result = await executeAction({ actionId: "MEDITATE" }, young);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBe("年龄不足");
      expect(result.code).toBe(400);
    }
  });

  it("境界不足返回 error", async () => {
    mockGetActionById.mockReturnValue({
      ...DEFAULT_ACTION,
      minRealm: "筑基期",
    });
    const mortal = { ...BASE_CULTIVATOR, realm: "凡人" };
    const result = await executeAction({ actionId: "STUDY" }, mortal);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toContain("境界不足");
      expect(result.code).toBe(400);
    }
  });

  it("快速失败不访问数据库事务", async () => {
    mockGetActionById.mockReturnValue(undefined);
    const { prisma } = await import("@/lib/prisma");
    await executeAction({ actionId: "GHOST" }, BASE_CULTIVATOR);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("executeAction - 核心成功路径", () => {
  it("MEDITATE 正常执行返回成功叙事", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.$transaction as any).mockImplementation((tx: any) =>
      tx(mockTx())
    );
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);

    const result = await executeAction({ actionId: "MEDITATE" }, BASE_CULTIVATOR);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.narrativeResult).toBeDefined();
      expect(result.data.narrativeResult.title).toBe("冥想");
      expect(result.data.actionEventId).toBe("evt1");
    }
  });

  it("扣除行动力且创建 ACTION 事件", async () => {
    const { prisma } = await import("@/lib/prisma");
    const tx = mockTx();
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);

    await executeAction({ actionId: "MEDITATE" }, BASE_CULTIVATOR);

    // 效果层应包含 -5 stamina
    expect(mockApplyEffects).toHaveBeenCalled();
    const effectsArg = mockClampEffectsArray.mock.calls[0]?.[0] ?? [];
    expect(effectsArg.some((e: any) => e.kind === "stamina" && e.delta === -5)).toBe(true);

    // gameEvent.create 被调用创建 ACTION 事件（参数嵌套在 data 下）
    expect(tx.gameEvent.create).toHaveBeenCalled();
    const createCall = tx.gameEvent.create.mock.calls.find(
      (c: any) => c[0]?.data?.type === "ACTION"
    );
    expect(createCall).toBeDefined();
  });

  it("凡人 16 岁觉醒触发 AWAKENING 事件", async () => {
    // 使用 WANDER（无 minRealm 限制）避免觉醒前境界不足
    const awakening = {
      ...BASE_CULTIVATOR,
      realm: "凡人",
      realmLevel: 0,
      age: 16,
    };
    const { prisma } = await import("@/lib/prisma");
    const tx = mockTx();
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);

    const result = await executeAction({ actionId: "WANDER" }, awakening);
    expect(result.status).toBe("success");

    // 应创建 AWAKENING 事件
    const awakeningCall = tx.gameEvent.create.mock.calls.find(
      (c: any) => c[0]?.data?.type === "AWAKENING"
    );
    expect(awakeningCall).toBeDefined();
    expect(awakeningCall[0].data.title).toBe("灵气觉醒");
  });

  it("长故事触发压缩", async () => {
    mockBuildSummaryFromEntries
      .mockReturnValueOnce("之前概要")
      .mockReturnValueOnce("x".repeat(1001));
    mockCompressStorySummary.mockResolvedValue("压缩后的记忆");
    mockCreateEntry
      .mockReturnValueOnce({ title: "记忆", narrative: "内容", important: false })
      .mockReturnValue({ title: "📜 记忆凝练", narrative: "压缩后的", important: false });

    const manyEntries = Array.from({ length: 45 }, (_, i) => ({
      title: `条目${i}`, narrative: "内容", important: i % 3 === 0,
    }));
    const cultivator = { ...BASE_CULTIVATOR, storyEntries: JSON.stringify(manyEntries) };

    const { prisma } = await import("@/lib/prisma");
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(mockTx()));
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);

    await executeAction({ actionId: "MEDITATE" }, cultivator);
    // 46 + 1 = 47 ≤ 50，但 summary 长度 > 1000 应触发压缩
    expect(mockCompressStorySummary).toHaveBeenCalled();
  });
});

describe("executeAction - EXPLORE 战斗分支", () => {
  const exploreCultivator = {
    ...BASE_CULTIVATOR,
    location: "wild",
    realm: "炼气期",
    age: 20,
  };

  const enemy = { id: "wolf", name: "妖狼" };

  beforeEach(() => {
    // EXPLORE 的 getActionById 已有 mock，但显式确保正确
    mockGetEnemiesForLocation.mockReturnValue([enemy]);
    mockResolveCombat.mockResolvedValue({
      win: true,
      loot: { gold: 15 },
      narrative: "你击败了妖狼！",
      style: "normal",
      enemy,
    });
  });

  it("战斗胜利返回金币效果", async () => {
    // 确保 Math.random < 0.3
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const { prisma } = await import("@/lib/prisma");
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(mockTx()));
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);
    (prisma.gameEvent.count as any).mockResolvedValue(0);

    const result = await executeAction({ actionId: "EXPLORE" }, exploreCultivator);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.narrativeResult.narrative).toBe("你击败了妖狼！");
      expect(result.data.narrativeResult.title).toBe("战斗胜利");
    }
    // 确认效果包含金币
    const effectsArg = mockClampEffectsArray.mock.calls[0]?.[0] ?? [];
    expect(effectsArg.some((e: any) => e.kind === "gold" && e.delta === 15)).toBe(true);
    vi.restoreAllMocks();
  });

  it("战斗失败施加 injuryDebuff", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    mockResolveCombat.mockResolvedValue({
      win: false,
      penalty: { goldLoss: 5, injuryDebuff: 3 },
      narrative: "你被妖狼击败了！",
      style: "normal",
      enemy,
    });
    const { prisma } = await import("@/lib/prisma");
    const tx = mockTx();
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);
    (prisma.gameEvent.count as any).mockResolvedValue(0);

    const result = await executeAction({ actionId: "EXPLORE" }, exploreCultivator);
    expect(result.status).toBe("success");
    // updateData 中应包含 injuryDebuff
    const updateCall = tx.cultivator.update.mock.calls[0]?.[0];
    expect(updateCall?.data?.injuryDebuff).toBe(3);
    vi.restoreAllMocks();
  });

  it("道消直接返回不提交事务", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    mockResolveCombat.mockResolvedValue({
      win: false,
      penalty: { daoXiao: true, goldLoss: 10 },
      narrative: "你道消了！",
      style: "normal",
      enemy,
    });
    const { prisma } = await import("@/lib/prisma");
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([]);
    (prisma.gameEvent.count as any).mockResolvedValue(0);

    const result = await executeAction({ actionId: "EXPLORE" }, exploreCultivator);
    expect(result.status).toBe("daoXiao");
    // $transaction 不应被调用
    expect(prisma.$transaction).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("executeAction - STUDY 功法分支", () => {
  const studyCultivator = {
    ...BASE_CULTIVATOR,
    realm: "筑基期",
    realmLevel: 1,
    age: 20,
  };

  const techniqueRecord = { id: "tr1", techniqueId: "qi_gathering", level: 1, proficiency: 50, equipSlot: 1 };

  beforeEach(() => {
    // STUDY 的 getActionById 已有全局 mock 处理
  });

  it("普通熟练度增长", async () => {
    mockAddProficiency.mockReturnValue({ newLevel: 1, newProficiency: 60, leveledUp: false });
    const { prisma } = await import("@/lib/prisma");
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([techniqueRecord]);
    const tx = mockTx();
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));

    const result = await executeAction({ actionId: "STUDY" }, studyCultivator);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.techniqueEvents).toHaveLength(1);
      expect(result.data.techniqueEvents[0].profGained).toBeGreaterThan(0);
      expect(result.data.techniqueEvents[0].leveledUp).toBe(false);
    }
  });

  it("升级触发功法更新", async () => {
    mockAddProficiency.mockReturnValue({ newLevel: 2, newProficiency: 0, leveledUp: true });
    const { prisma } = await import("@/lib/prisma");
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([techniqueRecord]);
    const tx = mockTx();
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));

    const result = await executeAction({ actionId: "STUDY" }, studyCultivator);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.techniqueEvents[0].leveledUp).toBe(true);
    }
    // 确认 cultivatorTechnique.update 被调用
    expect(tx.cultivatorTechnique.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tr1" },
        data: { level: 2, proficiency: 0 },
      })
    );
  });

  it("研读事件增加额外熟练度", async () => {
    mockTriggerStudyEvent.mockReturnValue({
      event: { extraProf: 15 },
      narrative: "你顿悟了！",
    });
    mockAddProficiency.mockReturnValue({ newLevel: 1, newProficiency: 75, leveledUp: false });
    const { prisma } = await import("@/lib/prisma");
    (prisma.cultivatorTechnique.findMany as any).mockResolvedValue([techniqueRecord]);
    const tx = mockTx();
    (prisma.$transaction as any).mockImplementation((fn: any) => fn(tx));

    const result = await executeAction({ actionId: "STUDY" }, studyCultivator);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.techniqueEvents[0].profGained).toBeGreaterThan(5);
      expect(result.data.techniqueEvents[0].eventNarrative).toBe("你顿悟了！");
    }
  });
});