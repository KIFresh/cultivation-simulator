import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateActionNarrative } from "../narrative";

vi.mock("../narrative/provider", () => ({
  callAI: vi.fn(),
  buildSystemPrompt: vi.fn(() => ""),
  AllProvidersFailedError: class AllProvidersFailedError extends Error {
    failures: Array<{ provider: string; model?: string; code: string }> = [];
    constructor(failures: Array<{ provider: string; model?: string; code: string }>) {
      super("ALL_PROVIDERS_FAILED");
      this.failures = failures;
    }
  },
}));

const mockCallAI = vi.mocked(await import("../narrative/provider")).callAI as jest.Mocked<any>;

const BASE_PARAMS = {
  cultivatorName: "赵晓安",
  spiritualRoot: "杂灵根",
  realm: "凡人",
  realmLevel: 1,
  age: 10,
  actionName: "与人交谈",
  actionDescription: "与身边的人交谈",
  expGained: 5,
  isAwakened: false,
  awakenEvent: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateActionNarrative - freeInput 保 Intent", () => {
  it("AI 返回空 narrative 时抛出错误", async () => {
    mockCallAI.mockResolvedValueOnce(
      '{"type":"ACTION","title":"","narrative":"","mood":"静","hint":"","summary":""}'
    );
    await expect(
      generateActionNarrative({ ...BASE_PARAMS, freeInput: "向爸爸要钱" })
    ).rejects.toThrow("叙事生成失败");
  });

  it("AI 抛错时向上传播错误", async () => {
    mockCallAI.mockRejectedValueOnce(new Error("AI 服务暂不可用"));
    await expect(generateActionNarrative({ ...BASE_PARAMS, freeInput: "叫妈妈" })).rejects.toThrow(
      "叙事生成失败"
    );
  });

  it("无 freeInput 且 AI 抛错时向上传播错误", async () => {
    mockCallAI.mockRejectedValueOnce(new Error("AI 服务暂不可用"));
    await expect(generateActionNarrative(BASE_PARAMS)).rejects.toThrow("叙事生成失败");
  });

  it("AI 正常返回时优先使用 AI 结果", async () => {
    mockCallAI.mockResolvedValueOnce(
      '{"type":"ACTION","title":"要零花钱","narrative":"赵晓安拽了拽爸爸的袖子，开口说今天想买文具。","mood":"静","hint":"看看爸爸的反应","summary":"向爸爸要钱。"}'
    );
    const result = await generateActionNarrative({ ...BASE_PARAMS, freeInput: "向爸爸要钱" });
    expect(result.title).toBe("要零花钱");
    expect(result.summary).toBe("向爸爸要钱。");
    expect(result.narrative).toContain("爸爸");
  });
});

describe("generateActionNarrative - 选中角色约束", () => {
  it("传入 npcNames 时 prompt 包含选中角色必须出现的约束", async () => {
    mockCallAI.mockResolvedValueOnce(
      '{"type":"ACTION","title":"回应","narrative":"赵晓安走到母亲面前，伸手要抱抱。","mood":"静","hint":"看看母亲的反应","summary":"向母亲撒娇。"}'
    );
    await generateActionNarrative({ ...BASE_PARAMS, npcNames: ["赵母"], freeInput: "向妈妈要钱" });
    const promptArg = mockCallAI.mock.calls[0]?.[0]?.userPrompt ?? "";
    expect(promptArg).toContain("赵母");
    expect(promptArg).toContain("不得无依据将其替换为其他未选中角色");
  });

  it("传入 npcNames 且 AI 正常返回时，使用 AI 结果", async () => {
    mockCallAI.mockResolvedValueOnce(
      '{"type":"ACTION","title":"要零花钱","narrative":"赵晓安拽着妈妈的衣角，仰头说要买新文具。","mood":"悟","hint":"妈妈会答应吗","summary":"向妈妈要零花钱。"}'
    );
    const result = await generateActionNarrative({
      ...BASE_PARAMS,
      npcNames: ["赵母"],
      freeInput: "向妈妈要钱",
    });
    expect(result.narrative).toContain("妈妈");
    expect(result.narrative).toContain("赵晓安");
    expect(result.narrative).not.toContain("爸爸");
  });

  it("选中 NPC 时，即使输入未点名也将其作为默认目标", async () => {
    mockCallAI.mockResolvedValueOnce(
      '{"type":"ACTION","title":"送茶","narrative":"赵晓安把热茶递给赵母。","mood":"静","hint":"等候回应","summary":"为赵母递茶。"}'
    );
    await generateActionNarrative({
      ...BASE_PARAMS,
      npcNames: ["赵母"],
      freeInput: "递上一杯热茶",
    });
    const promptArg = mockCallAI.mock.calls[0]?.[0]?.userPrompt ?? "";
    expect(promptArg).toContain("【本次行动目标】赵母");
    expect(promptArg).toContain("即使玩家描述未出现其姓名或称谓");
  });

  it("选中 NPC 且 AI 返回错误时向上传播错误", async () => {
    mockCallAI.mockRejectedValueOnce(new Error("AI 服务暂不可用"));
    await expect(
      generateActionNarrative({ ...BASE_PARAMS, npcNames: ["赵母"], freeInput: "递上一杯热茶" })
    ).rejects.toThrow("叙事生成失败");
  });

  it("选中 NPC 且没有输入时 AI 抛错仍向上传播", async () => {
    mockCallAI.mockRejectedValueOnce(new Error("AI 服务暂不可用"));
    await expect(generateActionNarrative({ ...BASE_PARAMS, npcNames: ["赵母"] })).rejects.toThrow(
      "叙事生成失败"
    );
  });
});
