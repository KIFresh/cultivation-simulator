import { describe, it, expect, vi } from "vitest";
import { safeJsonParse, parseJsonField, json } from "../json-helper";

vi.mock("../logger", () => ({
  logger: { warn: vi.fn() },
}));

describe("safeJsonParse", () => {
  it("应解析合法 JSON", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("null/undefined 应返回 fallback", () => {
    expect(safeJsonParse(null, 0)).toBe(0);
    expect(safeJsonParse(undefined, [])).toEqual([]);
  });

  it("非法 JSON 应返回 fallback", () => {
    expect(safeJsonParse("{bad}", 42)).toBe(42);
  });
});

describe("parseJsonField", () => {
  it("应解析合法 JSON", () => {
    const result = parseJsonField("[1,2]", [], "test");
    expect(result).toEqual([1, 2]);
  });

  it("解析失败时应调用 logger.warn 并返回 fallback", () => {
    const result = parseJsonField("{invalid}", [], "testField", "ctx");
    expect(result).toEqual([]);
  });
});

describe("json helper object", () => {
  it("json.storyEntries 应返回数组", () => {
    const raw = JSON.stringify([
      { id: "1", title: "t", summary: "s", important: false, createdAt: "now" },
    ]);
    const result = json.storyEntries(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("json.attributes 应返回对象", () => {
    expect(json.attributes('{"str":5}')).toEqual({ str: 5 });
  });

  it("json.inventory 应返回数组", () => {
    const raw = JSON.stringify([{ itemId: "a", quantity: 1, equipped: false }]);
    expect(json.inventory(raw)).toHaveLength(1);
  });

  it("json.unlockedLocations 应返回字符串数组", () => {
    expect(json.unlockedLocations('["town"]')).toEqual(["town"]);
  });

  it("json.talents 应返回字符串数组", () => {
    expect(json.talents('["fire"]')).toEqual(["fire"]);
  });

  it("json.reward 应返回对象", () => {
    expect(json.reward('{"gold":10}')).toEqual({ gold: 10 });
  });

  it("非法输入应返回默认 fallback", () => {
    expect(json.attributes(null)).toEqual({});
    expect(json.inventory(undefined)).toEqual([]);
    expect(json.unlockedLocations("bad")).toEqual([]);
  });
});
