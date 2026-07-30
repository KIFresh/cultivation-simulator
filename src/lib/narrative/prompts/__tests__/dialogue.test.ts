import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallAI = vi.fn();
vi.mock("@/lib/narrative/provider", () => ({ callAI: mockCallAI }));

const mockExtractJson = vi.fn();
vi.mock("@/lib/narrative", () => ({
  extractJson: mockExtractJson,
  buildStateContext: vi.fn(() => "mock state context"),
}));

// 导入被测试函数（必须在 mock 之后）
const { generateNPCDialogue, generateFamilyDialogue } = await import(
  "../dialogue"
);

// ── 有效返回值 ──────────────────────────────────────────────────

const validNPCDialogue = {
  type: "NPC_DIALOGUE",
  title: "与张三的对话",
  narrative: "张三打量了你一番，微微点头道：\"不错，年纪轻轻就有此修为。\"",
  mood: "奇",
  npcMood: "友善",
  summary: "与张三交谈。",
  reward: { itemId: "sword_01", type: "weapon", description: "一柄普通铁剑" },
  effects: [],
};

const validFamilyDialogue = {
  type: "FAMILY_DIALOGUE",
  title: "家庭对话",
  narrative: "母亲笑着拍了拍你的肩膀。",
  mood: "静",
  intimacyDelta: 2,
  npcMood: "开心",
  actionHint: "母亲可能给你做顿好吃的",
  summary: "与母亲交谈。",
  goldChange: 0,
  effects: [],
};

// ── generateNPCDialogue ─────────────────────────────────────────

describe("generateNPCDialogue", () => {
  const npcParams = {
    npcName: "张三",
    npcPersonality: "豪爽",
    npcRealm: "筑基",
    cultivatorName: "李四",
    cultivatorRealm: "练气",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应返回包含正确字段的 NPCDialogueNarrative", async () => {
    mockCallAI.mockResolvedValue('{"type":"NPC_DIALOGUE","title":"与张三的对话"}');
    mockExtractJson.mockReturnValue(validNPCDialogue);

    const result = await generateNPCDialogue(npcParams);

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockExtractJson).toHaveBeenCalledTimes(1);
    expect(result).toEqual(validNPCDialogue);
    expect(result.type).toBe("NPC_DIALOGUE");
    expect(result.npcMood).toBe("友善");
    expect(result.narrative).toBeTruthy();
    expect(result.summary).toBeTruthy();
  });

  it("当 callAI 抛出错误时应返回 fallback 对象", async () => {
    mockCallAI.mockRejectedValue(new Error("AI 服务不可用"));

    const result = await generateNPCDialogue(npcParams);

    // 函数内部 catch 后返回 fallback
    expect(result.type).toBe("NPC_DIALOGUE");
    expect(result.npcMood).toBe("冷淡");
    expect(result.narrative).toContain("正忙着，没空理你");
    expect(result.title).toBe("与张三的对话");
    expect(result.mood).toBe("静");
    expect(result.summary).toContain("不便打扰");
  });
});

// ── generateFamilyDialogue ──────────────────────────────────────

describe("generateFamilyDialogue", () => {
  const familyParams = {
    cultivatorName: "李四",
    cultivatorAge: 16,
    cultivatorRealm: "练气",
    familyMemberName: "王母",
    familyMemberRelation: "母亲",
    familyMemberAge: 40,
    intimacy: 80,
    playerMessage: "妈，我回来了",
    dialogueHistory: [
      { role: "player" as const, content: "我出门了" },
      { role: "npc" as const, content: "早点回来" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应返回包含正确字段的 FamilyDialogueNarrative", async () => {
    mockCallAI.mockResolvedValue('{"type":"FAMILY_DIALOGUE","title":"家庭对话"}');
    mockExtractJson.mockReturnValue(validFamilyDialogue);

    const result = await generateFamilyDialogue(familyParams);

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockExtractJson).toHaveBeenCalledTimes(1);
    expect(result).toEqual(validFamilyDialogue);
    expect(result.type).toBe("FAMILY_DIALOGUE");
    expect(result.npcMood).toBe("开心");
    expect(result.intimacyDelta).toBe(2);
    expect(result.narrative).toBeTruthy();
    expect(result.summary).toBeTruthy();
  });

  it("当 callAI 抛出错误时应返回 fallback 对象", async () => {
    mockCallAI.mockRejectedValue(new Error("AI 服务超时"));

    const result = await generateFamilyDialogue(familyParams);

    // 函数内部 catch 后返回 fallback
    expect(result.type).toBe("FAMILY_DIALOGUE");
    expect(result.npcMood).toBe("平淡");
    expect(result.narrative).toContain("正在忙，没听清你说什么");
    expect(result.title).toBe("家庭对话");
    expect(result.mood).toBe("静");
    expect(result.summary).toContain("正在忙");
    expect(result.intimacyDelta).toBe(0);
  });
});