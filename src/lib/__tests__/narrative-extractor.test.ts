import { describe, it, expect } from "vitest";
import { createNarrativeExtractor } from "../narrative-stream";

describe("createNarrativeExtractor", () => {
  it("增量推送时只返回 narrative 新增部分", () => {
    const ex = createNarrativeExtractor();
    expect(ex.push('{"type":"ACTION","title":"打坐","narrative":"')).toBe("");
    expect(ex.push("盘膝而坐")).toBe("盘膝而坐");
    expect(ex.push("，感受灵气")).toBe("，感受灵气");
    expect(ex.push('","mood":"静"}')).toBe("");
  });

  it("未闭合时也返回当前累积部分（尽力提取）", () => {
    const ex = createNarrativeExtractor();
    expect(ex.push('{"narrative":"开始写')).toBe("开始写");
    expect(ex.push("但没写完")).toBe("但没写完");
    expect(ex.push('","other":1}')).toBe("");
  });

  it("处理 narrative 内的转义引号", () => {
    const ex = createNarrativeExtractor();
    ex.push('{"narrative":"他说：\\"你好\\"，然后离开。","x":1}');
    expect(ex.push("")).toBe("");
  });

  it("完整 JSON 一次推送返回全部 narrative", () => {
    const ex = createNarrativeExtractor();
    expect(ex.push('{"type":"BIRTH","narrative":"产房里的灯光很暖。","summary":"出生"}')).toBe(
      "产房里的灯光很暖。"
    );
  });
});
