import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallAI = vi.fn();
vi.mock("@/lib/narrative/provider", () => ({ callAI: mockCallAI }));

const mockExtractJson = vi.fn();
vi.mock("@/lib/narrative", () => ({
  extractJson: mockExtractJson,
  buildStateContext: vi.fn(() => "mock state context"),
}));

async function loadModule() {
  return import("../gameplay");
}

const MOCK_AI_TEXT = '{"type":"TEST","title":"测试","narrative":"叙事内容","mood":"静","hint":"提示","summary":"概述"}';

const MOCK_NARRATIVE_RESULT = {
  type: "DAILY_CULTIVATION" as const,
  title: "日常修炼",
  narrative: "叙事内容",
  mood: "静",
  hint: "持之以恒",
  summary: "概述",
};

const MOCK_ENCOUNTER_RESULT = {
  type: "ENCOUNTER" as const,
  title: "意外发现",
  narrative: "叙事内容",
  choices: [
    { text: "小心探查", risk: "low" as const, hint: "稳扎稳打" },
    { text: "深入探索", risk: "medium" as const, hint: "风险与机遇并存" },
    { text: "全力闯入", risk: "high" as const, hint: "富贵险中求" },
  ],
  mood: "奇",
  summary: "概述",
};

describe("generateDailyCultivationNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAI.mockResolvedValue(MOCK_AI_TEXT);
    mockExtractJson.mockReturnValue(MOCK_NARRATIVE_RESULT);
  });

  it("应返回包含正确字段的 NarrativeResult", async () => {
    const { generateDailyCultivationNarrative } = await loadModule();
    const result = await generateDailyCultivationNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 1,
      taskType: "STUDY",
      cultivationExp: 100,
    });

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockExtractJson).toHaveBeenCalledTimes(1);
    expect(result).toEqual(MOCK_NARRATIVE_RESULT);
    expect(result).toHaveProperty("type", "DAILY_CULTIVATION");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("narrative");
    expect(result).toHaveProperty("mood");
    expect(result).toHaveProperty("hint");
    expect(result).toHaveProperty("summary");
  });

  it("应传递 storySummary 和 state 参数到 prompt", async () => {
    const { generateDailyCultivationNarrative } = await loadModule();
    await generateDailyCultivationNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 1,
      taskType: "MEDITATE",
      taskDescription: "盘膝而坐，闭目凝神",
      cultivationExp: 50,
      storySummary: "之前遇到了一个神秘老者",
      state: { location: "灵山", nearbyNPCs: ["老者"] },
    });

    const userPrompt = mockCallAI.mock.calls[0][0].userPrompt;
    expect(userPrompt).toContain("之前遇到了一个神秘老者");
    expect(userPrompt).toContain("mock state context");
  });

  it("AI 返回空内容时 catch 捕获并返回 fallback", async () => {
    const { generateDailyCultivationNarrative } = await loadModule();
    mockCallAI.mockResolvedValue("");
    mockExtractJson.mockImplementation(() => {
      throw new Error("extractJson failed on empty input");
    });

    const result = await generateDailyCultivationNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 1,
      taskType: "STUDY",
      cultivationExp: 100,
    });

    expect(result).toHaveProperty("type", "DAILY_CULTIVATION");
    expect(result.narrative).toContain("埋头苦练");
  });

  it("AI 调用失败时返回 fallback 而非抛出异常", async () => {
    const { generateDailyCultivationNarrative } = await loadModule();
    mockCallAI.mockRejectedValue(new Error("AI 服务不可用"));

    const result = await generateDailyCultivationNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 1,
      taskType: "STUDY",
      cultivationExp: 100,
    });

    expect(result).toHaveProperty("type", "DAILY_CULTIVATION");
    expect(result.narrative).toContain("埋头苦练");
  });
});

describe("generateBreakthroughNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAI.mockResolvedValue(MOCK_AI_TEXT);
    mockExtractJson.mockReturnValue({
      ...MOCK_NARRATIVE_RESULT,
      type: "BREAKTHROUGH",
    });
  });

  it("应返回包含正确字段的 NarrativeResult", async () => {
    const { generateBreakthroughNarrative } = await loadModule();
    const result = await generateBreakthroughNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      fromRealm: "筑基",
      fromLevel: 9,
      toRealm: "金丹",
      toLevel: 1,
      totalExp: 5000,
      breakthroughCount: 2,
    });

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockExtractJson).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty("type", "BREAKTHROUGH");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("narrative");
    expect(result).toHaveProperty("mood");
    expect(result).toHaveProperty("hint");
    expect(result).toHaveProperty("summary");
  });

  it("小境界突破（同一大境界内）也应正常工作", async () => {
    const { generateBreakthroughNarrative } = await loadModule();
    const result = await generateBreakthroughNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      fromRealm: "筑基",
      fromLevel: 1,
      toRealm: "筑基",
      toLevel: 2,
      totalExp: 200,
      breakthroughCount: 1,
    });

    expect(result).toHaveProperty("type", "BREAKTHROUGH");
  });

  it("AI 失败时返回 fallback", async () => {
    const { generateBreakthroughNarrative } = await loadModule();
    mockCallAI.mockRejectedValue(new Error("服务错误"));

    const result = await generateBreakthroughNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      fromRealm: "筑基",
      fromLevel: 9,
      toRealm: "金丹",
      toLevel: 1,
      totalExp: 5000,
      breakthroughCount: 2,
    });

    expect(result).toHaveProperty("type", "BREAKTHROUGH");
    expect(result.narrative).toContain("捅破了那层窗户纸");
  });
});

describe("generateEncounterNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAI.mockResolvedValue(MOCK_AI_TEXT);
    mockExtractJson.mockReturnValue(MOCK_ENCOUNTER_RESULT);
  });

  it("应返回包含正确字段的 EncounterNarrative", async () => {
    const { generateEncounterNarrative } = await loadModule();
    const result = await generateEncounterNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 3,
    });

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockExtractJson).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty("type", "ENCOUNTER");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("narrative");
    expect(result).toHaveProperty("choices");
    expect(Array.isArray(result.choices)).toBe(true);
    expect(result.choices.length).toBeGreaterThan(0);
    expect(result.choices[0]).toHaveProperty("text");
    expect(result.choices[0]).toHaveProperty("risk");
    expect(result.choices[0]).toHaveProperty("hint");
    expect(result).toHaveProperty("mood");
    expect(result).toHaveProperty("summary");
  });

  it("AI 失败时返回 fallback 奇遇", async () => {
    const { generateEncounterNarrative } = await loadModule();
    mockCallAI.mockRejectedValue(new Error("生成失败"));

    const result = await generateEncounterNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 3,
    });

    expect(result).toHaveProperty("type", "ENCOUNTER");
    expect(result.choices).toHaveLength(3);
    expect(result.narrative).toContain("不对劲的地方");
  });
});

describe("generateActionNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAI.mockResolvedValue(MOCK_AI_TEXT);
    mockExtractJson.mockReturnValue({
      ...MOCK_NARRATIVE_RESULT,
      type: "ACTION",
    });
  });

  it("应返回包含正确字段的 NarrativeResult", async () => {
    const { generateActionNarrative } = await loadModule();
    const result = await generateActionNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 3,
      age: 18,
      actionName: "练剑",
      actionDescription: "在瀑布下练习剑法",
      expGained: 30,
      isAwakened: true,
      awakenEvent: false,
    });

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockExtractJson).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty("type", "ACTION");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("narrative");
    expect(result).toHaveProperty("mood");
    expect(result).toHaveProperty("hint");
    expect(result).toHaveProperty("summary");
  });

  it("凡人未觉醒状态也应正常工作", async () => {
    const { generateActionNarrative } = await loadModule();
    const result = await generateActionNarrative({
      cultivatorName: "小明",
      spiritualRoot: "无",
      realm: "凡人",
      realmLevel: 0,
      age: 10,
      actionName: "读书",
      actionDescription: "在学堂读书认字",
      expGained: 0,
      isAwakened: false,
      awakenEvent: false,
    });

    expect(result).toHaveProperty("type", "ACTION");
  });

  it("觉醒事件标记应出现在 prompt 中", async () => {
    const { generateActionNarrative } = await loadModule();
    await generateActionNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "凡人",
      realmLevel: 0,
      age: 16,
      actionName: "冥想",
      actionDescription: "在山巅冥想",
      expGained: 100,
      isAwakened: true,
      awakenEvent: true,
    });

    const userPrompt = mockCallAI.mock.calls[0][0].userPrompt;
    expect(userPrompt).toContain("觉醒时刻");
  });

  it("AI 失败时返回 fallback", async () => {
    const { generateActionNarrative } = await loadModule();
    mockCallAI.mockRejectedValue(new Error("失败"));

    const result = await generateActionNarrative({
      cultivatorName: "清玄",
      spiritualRoot: "天灵根",
      realm: "筑基",
      realmLevel: 3,
      age: 18,
      actionName: "练剑",
      actionDescription: "练剑",
      expGained: 30,
      isAwakened: true,
      awakenEvent: false,
    });

    expect(result).toHaveProperty("type", "ACTION");
    expect(result.narrative).toContain("练剑了一番");
  });
});

describe("generateYearAdvanceNarrative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAI.mockResolvedValue(MOCK_AI_TEXT);
    mockExtractJson.mockReturnValue({
      ...MOCK_NARRATIVE_RESULT,
      type: "YEAR_ADVANCE",
    });
  });

  it("应返回包含正确字段的 NarrativeResult", async () => {
    const { generateYearAdvanceNarrative } = await loadModule();
    const result = await generateYearAdvanceNarrative({
      cultivatorName: "清玄",
      age: 18,
      realm: "筑基",
      realmLevel: 3,
      spiritualRoot: "天灵根",
    });

    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockExtractJson).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty("type", "YEAR_ADVANCE");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("narrative");
    expect(result).toHaveProperty("mood");
    expect(result).toHaveProperty("hint");
    expect(result).toHaveProperty("summary");
  });

  it("AI 失败时返回 fallback", async () => {
    const { generateYearAdvanceNarrative } = await loadModule();
    mockCallAI.mockRejectedValue(new Error("失败"));

    const result = await generateYearAdvanceNarrative({
      cultivatorName: "清玄",
      age: 19,
      realm: "金丹",
      realmLevel: 1,
      spiritualRoot: "天灵根",
    });

    expect(result).toHaveProperty("type", "YEAR_ADVANCE");
    expect(result.narrative).toContain("又长了一岁");
  });
});