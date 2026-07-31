import { describe, it, expect, vi, beforeEach } from "vitest";
import { fallbackBirthName, validateBirthConsistency, generateBirthNarrative } from "../birth";

// ── Mocks ──────────────────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/narrative/provider", () => ({
  callAI: vi.fn(),
}));

vi.mock("@/lib/narrative", () => ({
  extractJson: vi.fn(),
}));

// ── fallbackBirthName ──────────────────────────────────────────────────────────────────────────────

describe("fallbackBirthName", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("应返回字符串且在备用名列表中", () => {
    const names = ["小石头", "小宝", "阿福", "小安"];
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(fallbackBirthName()).toBe("小石头");

    vi.spyOn(Math, "random").mockReturnValue(0.25);
    expect(fallbackBirthName()).toBe("小宝");

    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(fallbackBirthName()).toBe("阿福");

    vi.spyOn(Math, "random").mockReturnValue(0.75);
    expect(fallbackBirthName()).toBe("小安");
  });

  it("应返回列表中的某个值", () => {
    const names = ["小石头", "小宝", "阿福", "小安"];
    const result = fallbackBirthName();
    expect(names).toContain(result);
  });
});

// ── validateBirthConsistency ──────────────────────────────────────────────────────────────────────

describe("validateBirthConsistency", () => {
  it("空叙事返回错误", () => {
    const errors = validateBirthConsistency("", "小明", []);
    expect(errors).toEqual(["叙事正文为空"]);
  });

  it("名字不在正文中返回错误", () => {
    const narrative = "今天是个好日子。";
    const errors = validateBirthConsistency(narrative, "小明", []);
    expect(errors).toContain('建议姓名"小明"未出现在叙事正文中');
  });

  it("年龄不合理返回错误", () => {
    const narrative = "小明出生了。";
    const errors = validateBirthConsistency(narrative, "小明", [
      { relation: "母亲", name: "王氏", age: -1, alive: true },
    ]);
    expect(errors).toContain('"母亲 王氏"的年龄不合理(-1)');
  });

  it("正文提到关系但 family 中无对应成员返回错误", () => {
    const narrative = "父亲抱着小明。";
    const errors = validateBirthConsistency(narrative, "小明", [
      { relation: "母亲", name: "王氏", age: 30, alive: true },
    ]);
    expect(errors).toContain('正文提到了"父亲"，但 family 中没有对应成员（期望关系"父亲"）');
  });

  it("完全一致时返回空数组", () => {
    const narrative = "父亲抱着小明，母亲在一旁微笑。";
    const errors = validateBirthConsistency(narrative, "小明", [
      { relation: "父亲", name: "父亲", age: 35, alive: true },
      { relation: "母亲", name: "母亲", age: 30, alive: true },
    ]);
    expect(errors).toEqual([]);
  });

  it("关系重复时返回错误", () => {
    const narrative = "父亲抱着小明。";
    const errors = validateBirthConsistency(narrative, "小明", [
      { relation: "父亲", name: "父亲1", age: 35, alive: true },
      { relation: "父亲", name: "父亲2", age: 40, alive: true },
    ]);
    expect(errors).toContain('关系"父亲"出现重复（已有同名关系成员）');
  });

  it("空的 relation 返回错误", () => {
    const narrative = "小明出生了。";
    const errors = validateBirthConsistency(narrative, "小明", [
      { relation: "", name: "无名氏", age: 30, alive: true },
    ]);
    expect(errors).toContain('家庭成员"无名氏"的关系为空');
  });
});

// ── generateBirthNarrative ────────────────────────────────────────────────────────────────────────

describe("generateBirthNarrative", () => {
  const mockParams = {
    cultivatorName: "小明",
    worldName: "修仙界",
    identityName: "散修",
    birthTier: "凡人",
    worldId: "w001",
    family: [
      { relation: "父亲", name: "父亲", age: 35, alive: true },
      { relation: "母亲", name: "母亲", age: 30, alive: true },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AI 返回有效数据时返回正确结果", async () => {
    const { callAI } = await import("@/lib/narrative/provider");
    const { extractJson } = await import("@/lib/narrative");

    const mockData = {
      type: "BIRTH",
      title: "新生命降临",
      narrative: "父亲抱着小明，母亲在一旁微笑。",
      mood: "奇",
      hint: "健康成长",
      summary: "一个温馨的家庭场景",
      suggestedName: "小明",
      family: [
        { relation: "父亲", name: "父亲", age: 35, alive: true },
        { relation: "母亲", name: "母亲", age: 30, alive: true },
      ],
      effects: [],
    };
    const mockAiResponse = JSON.stringify(mockData);

    vi.mocked(callAI).mockResolvedValue(mockAiResponse);
    vi.mocked(extractJson).mockReturnValue(mockData);

    const result = await generateBirthNarrative(mockParams);

    expect(result).toHaveProperty("type", "BIRTH");
    expect(result).toHaveProperty("narrative");
    expect(result).toHaveProperty("suggestedName", "小明");
    expect(callAI).toHaveBeenCalledTimes(1);
  });

  it("将出身线索作为隐性创作参考，不要求直接复述家境", async () => {
    const { callAI } = await import("@/lib/narrative/provider");
    const { extractJson } = await import("@/lib/narrative");
    const mockData = {
      type: "BIRTH",
      title: "新生命降临",
      narrative: "父亲抱着小明，母亲在一旁微笑。",
      mood: "奇",
      hint: "健康成长",
      summary: "窗边旧书和暖灯映出家的安静",
      suggestedName: "小明",
      family: [
        { relation: "父亲", name: "父亲", age: 35, alive: true },
        { relation: "母亲", name: "母亲", age: 30, alive: true },
      ],
      effects: [],
    };
    vi.mocked(callAI).mockResolvedValue(JSON.stringify(mockData));
    vi.mocked(extractJson).mockReturnValue(mockData);

    await generateBirthNarrative({ ...mockParams, identityName: "书香门第" });

    const prompt = vi.mocked(callAI).mock.calls[0]?.[0]?.userPrompt;
    expect(prompt).toContain("仅供构思，禁止在成文中直接复述");
    expect(prompt).toContain("正文、标题、summary、hint 中都不得直接复述");
    expect(prompt).toContain("父母职业及工作物件、产房或住宅环境");
    expect(prompt).toContain("书香门第");
  });
  it("AI 返回空内容时抛出错误", async () => {
    const { callAI } = await import("@/lib/narrative/provider");
    const { extractJson } = await import("@/lib/narrative");

    const mockData = {
      type: "BIRTH",
      title: "",
      narrative: "",
      mood: "",
      hint: "",
      summary: "",
      suggestedName: "",
      family: [],
      effects: [],
    };
    const mockAiResponse = JSON.stringify(mockData);

    vi.mocked(callAI).mockResolvedValue(mockAiResponse);
    vi.mocked(extractJson).mockReturnValue(mockData);

    await expect(generateBirthNarrative(mockParams)).rejects.toThrow("出生叙事AI生成失败");
  });
});