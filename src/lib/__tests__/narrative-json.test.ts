// ═══════════════════════════════════════════════════════════════════════════
// narrative-json.test.ts — strictExtractJson 与 strictExtractAndValidate 单测
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { strictExtractJson, strictExtractAndValidate } from "../narrative-json";

describe("strictExtractJson", () => {
  it("应成功解析完整 JSON 文本", () => {
    const { result, errors } = strictExtractJson('{"a":1,"b":"hello"}');
    expect(result).toEqual({ a: 1, b: "hello" });
    expect(errors).toEqual([]);
  });

  it("应从 Markdown 代码块中提取 JSON", () => {
    const { result, errors } = strictExtractJson(
      '```json\n{"title":"测试","narrative":"内容"}\n```'
    );
    expect(result).toEqual({ title: "测试", narrative: "内容" });
    expect(errors).toEqual([]);
  });

  it("应从 Markdown 代码块中提取 JSON（无语言标识）", () => {
    const { result, errors } = strictExtractJson('```\n{"mood":"平静"}\n```');
    expect(result).toEqual({ mood: "平静" });
    expect(errors).toEqual([]);
  });

  it("应通过括号计数法提取 JSON", () => {
    const { result, errors } = strictExtractJson('前面有文字{"a":1,"b":[1,2,3]}后面也有文字');
    expect(result).toEqual({ a: 1, b: [1, 2, 3] });
    expect(errors).toEqual([]);
  });

  it("应拒绝数组 JSON", () => {
    const { result, errors } = strictExtractJson("[1,2,3]");
    expect(result).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("应拒绝无效字符串", () => {
    const { result, errors } = strictExtractJson("不是 JSON");
    expect(result).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("应拒绝空字符串", () => {
    const { result, errors } = strictExtractJson("");
    expect(result).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it("应处理嵌套对象", () => {
    const { result, errors } = strictExtractJson(
      '{"title":"觉醒","narrative":"你感到体内灵气涌动。","mood":"惊喜","effects":[{"kind":"gold","delta":5}]}'
    );
    expect(result).toHaveProperty("title", "觉醒");
    expect(result).toHaveProperty("mood", "惊喜");
    expect((result as any)?.effects).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});

describe("strictExtractAndValidate", () => {
  it("应成功解析并校验", () => {
    const validator = (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (typeof d?.title === "string" && typeof d?.narrative === "string") {
        return { success: true, errors: [] as string[] };
      }
      return { success: false, errors: ["缺少必需字段"] };
    };
    const result = strictExtractAndValidate('{"title":"T","narrative":"N"}', validator);
    expect(result.success).toBe(true);
  });

  it("解析失败时应返回错误", () => {
    const validator = () => ({ success: true, data: {}, errors: [] as string[] });
    const result = strictExtractAndValidate("not json", validator);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("校验失败时应返回错误", () => {
    const validator = () => ({ success: false, errors: ["校验失败"] });
    const result = strictExtractAndValidate('{"a":1}', validator);
    expect(result.success).toBe(false);
    expect(result.errors).toContain("校验失败");
  });
});
