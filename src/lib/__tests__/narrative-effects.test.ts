import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock clampGoldDelta to avoid prisma.goldTransactionRecord dependency in unit tests
vi.mock("../gold", () => ({
  clampGoldDelta: (delta: number, currentGold: number, maxAbsDelta = 10000) => {
    const n = typeof delta === "number" ? delta : Number(delta);
    if (!Number.isFinite(n)) return 0;
    let d = Math.trunc(n);
    const cap = Math.abs(maxAbsDelta);
    if (d > cap) d = cap;
    if (d < -cap) d = -cap;
    if (currentGold + d < 0) d = -currentGold;
    if (currentGold + d > 10_000_000) d = 10_000_000 - currentGold;
    return d;
  },
}));

import {
  NarrativeEffectSchema,
  extractEffects,
  clampEffect,
  clampEffectsArray,
  aggregateEffects,
  applyEffects,
  validateEffects,
  type NarrativeEffect,
  type ClampConfig,
  type ApplyContext,
} from "../narrative-effects";

// ── Schema 校验 ──────────────────────────────────────────────────────

describe("NarrativeEffectSchema", () => {
  it("接受合法 gold 效果", () => {
    const result = NarrativeEffectSchema.parse({ kind: "gold", delta: 10 });
    expect(result).toEqual({ kind: "gold", delta: 10 });
  });

  it("接受合法 stamina 效果", () => {
    const result = NarrativeEffectSchema.parse({ kind: "stamina", delta: -5 });
    expect(result).toEqual({ kind: "stamina", delta: -5 });
  });

  it("接受合法 intimacy 效果", () => {
    const result = NarrativeEffectSchema.parse({
      kind: "intimacy",
      delta: 3,
      targetRelation: "母亲",
    });
    expect(result).toEqual({ kind: "intimacy", delta: 3, targetRelation: "母亲" });
  });

  it("拒绝未知 kind", () => {
    expect(() => NarrativeEffectSchema.parse({ kind: "fly", delta: 10 })).toThrow();
  });

  it("拒绝未知字段", () => {
    expect(() => NarrativeEffectSchema.parse({ kind: "gold", delta: 10, evil: true })).toThrow();
  });

  it("拒绝非法 intimacy delta（超出 -20~20）", () => {
    expect(() =>
      NarrativeEffectSchema.parse({ kind: "intimacy", delta: 50, targetRelation: "母亲" })
    ).toThrow();
  });

  it("接受合法 attrExp 效果", () => {
    const result = NarrativeEffectSchema.parse({
      kind: "attrExp",
      values: { root: 15, spirit: 10 },
    });
    expect(result).toEqual({ kind: "attrExp", values: { root: 15, spirit: 10 } });
  });

  it("拒绝非法 attrExp 值（负数）", () => {
    expect(() => NarrativeEffectSchema.parse({ kind: "attrExp", values: { root: -5 } })).toThrow();
  });

  it("拒绝已知但非法 attrExp 字段（拼写错误）", () => {
    expect(() =>
      NarrativeEffectSchema.parse({
        kind: "attrExp",
        values: { rooot: 5 },
      })
    ).toThrow();
  });

  it("接受合法 storyEntry 效果", () => {
    const result = NarrativeEffectSchema.parse({
      kind: "storyEntry",
      title: "奇遇",
      narrative: "路边捡到一块灵石",
    });
    expect(result.kind).toBe("storyEntry");
  });

  it("接受合法 familyReplace 效果", () => {
    const result = NarrativeEffectSchema.parse({
      kind: "familyReplace",
      members: [{ relation: "父亲", name: "罗大", age: 40, alive: true, occupation: "铁匠" }],
    });
    expect(result.kind).toBe("familyReplace");
  });
});

// ── extractEffects ──────────────────────────────────────────────────

describe("extractEffects", () => {
  it("从具有 effects 数组的对象中提取", () => {
    const result = extractEffects({ effects: [{ kind: "gold", delta: 5 }], other: "x" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "gold", delta: 5 });
  });

  it("从 narrative 响应中提取", () => {
    const result = extractEffects({
      narrative: "...",
      mood: "静",
      effects: [{ kind: "stamina", delta: -3 }],
    });
    expect(result).toHaveLength(1);
  });

  it("返回空数组当无 effects 字段", () => {
    expect(extractEffects({})).toEqual([]);
  });

  it("过滤非法效果", () => {
    const result = extractEffects({
      effects: [
        { kind: "gold", delta: 5 },
        { kind: "invalid", delta: 1 },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ kind: "gold", delta: 5 });
  });
});

// ── clampEffect ─────────────────────────────────────────────────────

describe("clampEffect", () => {
  const config: ClampConfig = { maxGold: 200, maxStamina: 100, maxHealth: 100, maxMindDemon: 100 };

  it("gold 不降低到负数以下", () => {
    expect(clampEffect({ kind: "gold", delta: -50 }, { ...config, currentGold: 30 })).toEqual({
      kind: "gold",
      delta: -30,
    });
  });

  it("gold 不超过上限", () => {
    expect(clampEffect({ kind: "gold", delta: 50 }, { ...config, currentGold: 180 })).toEqual({
      kind: "gold",
      delta: 20,
    });
  });

  it("gold 受 maxGoldAbsDelta 限制", () => {
    const cfg: ClampConfig = { currentGold: 1000, maxGoldAbsDelta: 50 };
    expect(clampEffect({ kind: "gold", delta: 100 }, cfg)).toEqual({ kind: "gold", delta: 50 });
    expect(clampEffect({ kind: "gold", delta: -100 }, cfg)).toEqual({ kind: "gold", delta: -50 });
  });

  it("stamina 不超出 [0, maxStamina]", () => {
    expect(clampEffect({ kind: "stamina", delta: 10 }, { ...config, currentStamina: 95 })).toEqual({
      kind: "stamina",
      delta: 5,
    });
    expect(clampEffect({ kind: "stamina", delta: -10 }, { ...config, currentStamina: 5 })).toEqual({
      kind: "stamina",
      delta: -5,
    });
  });

  it("health 不超出 [0, maxHealth]", () => {
    expect(clampEffect({ kind: "health", delta: -200 }, { ...config, currentHealth: 50 })).toEqual({
      kind: "health",
      delta: -50,
    });
  });

  it("intimacy 不超出 [0, 100]", () => {
    expect(
      clampEffect(
        { kind: "intimacy", delta: 60, targetRelation: "母亲" },
        { ...config, currentIntimacy: 50, maxIntimacyAbsDelta: 60 }
      )
    ).toEqual({ kind: "intimacy", delta: 50, targetRelation: "母亲" });
    expect(
      clampEffect(
        { kind: "intimacy", delta: -60, targetRelation: "母亲" },
        { ...config, currentIntimacy: 50, maxIntimacyAbsDelta: 60 }
      )
    ).toEqual({ kind: "intimacy", delta: -50, targetRelation: "母亲" });
  });

  it("mindDemon 不降低到负数以下", () => {
    expect(
      clampEffect({ kind: "mindDemon", delta: -10 }, { ...config, currentMindDemon: 3 })
    ).toEqual({ kind: "mindDemon", delta: -3 });
  });
});

// ── aggregateEffects ────────────────────────────────────────────────

describe("aggregateEffects", () => {
  it("聚合同类 gold 效果", () => {
    const result = aggregateEffects([
      { kind: "gold", delta: 10 },
      { kind: "gold", delta: 20 },
    ]);
    const gold = result.filter((e) => e.kind === "gold");
    expect(gold).toHaveLength(1);
    if (gold[0].kind === "gold") expect(gold[0].delta).toBe(30);
  });

  it("聚合同类 gold 正负混合效果累加", () => {
    const result = aggregateEffects([
      { kind: "gold", delta: 10 },
      { kind: "gold", delta: -4 },
    ]);
    const gold = result.filter((e) => e.kind === "gold");
    expect(gold).toHaveLength(1);
    if (gold[0].kind === "gold") expect(gold[0].delta).toBe(6);
  });

  it("聚合后保留其他效果", () => {
    const result = aggregateEffects([
      { kind: "gold", delta: 10 },
      { kind: "stamina", delta: -5 },
      { kind: "intimacy", delta: 3, targetRelation: "母亲" },
    ]);
    expect(result.filter((e) => e.kind === "gold")).toHaveLength(1);
    expect(result.filter((e) => e.kind === "stamina")).toHaveLength(1);
    expect(result.filter((e) => e.kind === "intimacy")).toHaveLength(1);
  });

  it("聚合同类 attrExp", () => {
    const result = aggregateEffects([
      { kind: "attrExp", values: { root: 10, spirit: 5 } },
      { kind: "attrExp", values: { root: 5, luck: 3 } },
    ] as NarrativeEffect[]);
    const attr = result.find((e) => e.kind === "attrExp") as any;
    expect(attr.values.root).toBe(15);
    expect(attr.values.spirit).toBe(5);
    expect(attr.values.luck).toBe(3);
  });

  it("clampEffectsArray 批量钳制", () => {
    const config: ClampConfig = {
      maxGold: 200,
      maxStamina: 100,
      maxHealth: 100,
      maxMindDemon: 100,
    };
    const result = clampEffectsArray(
      [
        { kind: "gold", delta: 500 },
        { kind: "stamina", delta: -200 },
      ],
      { ...config, currentGold: 150, currentStamina: 10 }
    );
    const gold = result.find((e) => e.kind === "gold") as any;
    const stamina = result.find((e) => e.kind === "stamina") as any;
    expect(gold.delta).toBe(50); // 200-150=50
    expect(stamina.delta).toBe(-10); // 0-10=-10
  });

  it("clampEffect 边界：无 currentStamina 时仅做绝对限幅", () => {
    const config: ClampConfig = {
      maxGold: 200,
      maxStamina: 100,
      maxHealth: 100,
      maxMindDemon: 100,
    };
    expect(clampEffect({ kind: "stamina", delta: 200 }, config)).toEqual({
      kind: "stamina",
      delta: 50,
    });
  });

  it("clampEffect 边界：无 currentHealth 时仅做绝对限幅", () => {
    const config: ClampConfig = {
      maxGold: 200,
      maxStamina: 100,
      maxHealth: 100,
      maxMindDemon: 100,
    };
    expect(clampEffect({ kind: "health", delta: 200 }, config)).toEqual({
      kind: "health",
      delta: 100,
    });
  });

  it("clampEffect 边界：无 currentMindDemon 时仅做绝对限幅", () => {
    const config: ClampConfig = {
      maxGold: 200,
      maxStamina: 100,
      maxHealth: 100,
      maxMindDemon: 100,
    };
    expect(clampEffect({ kind: "mindDemon", delta: 200 }, config)).toEqual({
      kind: "mindDemon",
      delta: 100,
    });
  });

  it("aggregateEffects 移除 stamina 合计为零", () => {
    const result = aggregateEffects([
      { kind: "stamina", delta: -10 },
      { kind: "stamina", delta: 10 },
    ]);
    expect(result.filter((e) => e.kind === "stamina")).toHaveLength(0);
  });

  it("aggregateEffects 移除 health 合计为零", () => {
    const result = aggregateEffects([
      { kind: "health", delta: 5 },
      { kind: "health", delta: -5 },
    ]);
    expect(result.filter((e) => e.kind === "health")).toHaveLength(0);
  });

  it("aggregateEffects 移除 mindDemon 合计为零", () => {
    const result = aggregateEffects([
      { kind: "mindDemon", delta: 3 },
      { kind: "mindDemon", delta: -3 },
    ]);
    expect(result.filter((e) => e.kind === "mindDemon")).toHaveLength(0);
  });

  it("aggregateEffects attrExp 全部累加为 0 时保留", () => {
    const result = aggregateEffects([
      { kind: "attrExp", values: { root: 5, spirit: 3 } },
      { kind: "attrExp", values: { root: -5, spirit: -3 } },
    ] as NarrativeEffect[]);
    const attr = result.find((e) => e.kind === "attrExp");
    expect(attr).toBeDefined();
    if (attr && attr.kind === "attrExp") {
      expect(attr.values.root).toBe(0);
      expect(attr.values.spirit).toBe(0);
    }
  });
});

describe("validateEffects", () => {
  it("通过合法效果列表", () => {
    const { valid, errors } = validateEffects([
      { kind: "gold", delta: 10 },
      { kind: "stamina", delta: -5 },
    ]);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it("过滤非法效果并返回错误", () => {
    const { valid, errors } = validateEffects([
      { kind: "gold", delta: 10 },
      { kind: "fly", delta: 1 },
      { kind: "gold", delta: -5 },
    ]);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(1);
  });

  it("处理混合输入：undefined、null", () => {
    const { valid, errors } = validateEffects([null, undefined, { kind: "gold", delta: 5 }]);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it("过滤 intimacy delta=0 的效果", () => {
    const { valid, errors } = validateEffects([
      { kind: "intimacy", delta: 0, targetRelation: "母亲" },
      { kind: "gold", delta: 5 },
    ]);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});

describe("storyEntry 压缩", () => {
  it("超过 50 条时通过 applyEffects 压缩", async () => {
    const mockTx = {
      cultivator: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const baseCtx = { cultivatorId: "c1", currentGold: 0, currentStamina: 0, maxStamina: 100 };

    // 构造 60 条 storyEntries（40 条重要旧条目 + 20 条普通新条目）
    const entries = [];
    for (let i = 0; i < 40; i++) {
      entries.push({
        title: `重要事件${i}`,
        narrative: `重要描述${i}`,
        important: true,
        createdAt: new Date(1000 * i).toISOString(),
      });
    }
    for (let i = 0; i < 20; i++) {
      entries.push({
        title: `普通事件${i}`,
        narrative: `普通描述${i}`,
        important: false,
        createdAt: new Date(1000 * 100 + 1000 * i).toISOString(),
      });
    }
    expect(entries).toHaveLength(60);

    mockTx.cultivator.findUnique.mockResolvedValue({ storyEntries: JSON.stringify(entries) });
    mockTx.cultivator.update.mockResolvedValue({});

    await applyEffects(
      [{ kind: "storyEntry", title: "新事件", narrative: "新叙事", important: false }],
      mockTx as any,
      baseCtx
    );

    const updateCall = mockTx.cultivator.update.mock.calls[0][0];
    const result = JSON.parse(updateCall.data.storyEntries);
    // 压缩后 ≤ 50 条
    expect(result.length).toBeLessThanOrEqual(50);
    // 保留最近 10 条中的普通条目（entry 51-59 = 普通事件11-19）
    for (let i = 11; i < 20; i++) {
      expect(result.some((e: any) => e.title === `普通事件${i}`)).toBe(true);
    }
    // 新事件已追加
    expect(result.some((e: any) => e.title === "新事件")).toBe(true);
  });
});

// ── applyEffects（集成测试）─────────────────────────────────────────

describe("applyEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTx = {
    cultivator: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    familyMember: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  const baseCtx: ApplyContext = {
    cultivatorId: "c1",
    currentGold: 100,
    currentStamina: 80,
    maxStamina: 100,
  };

  it("gold 效果正确 increment", async () => {
    mockTx.cultivator.update.mockResolvedValue({});
    await applyEffects([{ kind: "gold", delta: 10 }], mockTx as any, baseCtx);
    expect(mockTx.cultivator.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: { gold: { increment: 10 } },
      })
    );
  });

  it("stamina 效果正确 increment", async () => {
    mockTx.cultivator.update.mockResolvedValue({});
    await applyEffects([{ kind: "stamina", delta: -5 }], mockTx as any, baseCtx);
    expect(mockTx.cultivator.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: { stamina: { increment: -5 } },
      })
    );
  });

  it("attrExp 正确走 addAttrExp（100×level^1.5 曲线，旧存档裸数字视为 0 经验）", async () => {
    mockTx.cultivator.findUnique.mockResolvedValue({ attributeExp: '{"root":5,"spirit":3}' });
    mockTx.cultivator.update.mockResolvedValue({});
    await applyEffects(
      [{ kind: "attrExp", values: { root: 10, luck: 5 } }],
      mockTx as any,
      baseCtx
    );
    const updateCall = mockTx.cultivator.update.mock.calls[0][0];
    const written = JSON.parse(updateCall.data.attributeExp);
    expect(written.root).toEqual({ exp: 10, level: 0 }); // 旧存档 5 视为 0 经验，+10
    expect(written.spirit).toEqual({ exp: 0, level: 0 }); // 旧存档裸数字 → 0 经验
    expect(written.luck).toEqual({ exp: 5, level: 0 }); // 新增
  });

  it("storyEntry 正确追加到 entries", async () => {
    mockTx.cultivator.findUnique.mockResolvedValue({ storyEntries: "[]" });
    mockTx.cultivator.update.mockResolvedValue({});
    await applyEffects(
      [{ kind: "storyEntry", title: "奇遇", narrative: "路边捡到灵石", important: true }],
      mockTx as any,
      baseCtx
    );
    const updateCall = mockTx.cultivator.update.mock.calls[0][0];
    const entries = JSON.parse(updateCall.data.storyEntries);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("奇遇");
    expect(entries[0].important).toBe(true);
  });

  it("familyReplace 包含 occupation", async () => {
    mockTx.familyMember.findMany.mockResolvedValue([]);
    mockTx.cultivator.update.mockResolvedValue({});
    await applyEffects(
      [
        {
          kind: "familyReplace",
          members: [{ relation: "父亲", name: "罗大", age: 40, alive: true, occupation: "铁匠" }],
        },
      ],
      mockTx as any,
      baseCtx
    );
    expect(mockTx.familyMember.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ occupation: "铁匠" })]),
      })
    );
  });
});
