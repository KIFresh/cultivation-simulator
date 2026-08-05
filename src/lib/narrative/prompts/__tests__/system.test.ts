import { describe, it, expect, vi } from "vitest";
import {
  SYSTEM_PROMPT_BASE,
  SYSTEM_PROMPT_CIVILIAN,
  buildSystemPrompt,
} from "../system";

// Mock getWorldAIPrompt
vi.mock("@/lib/worlds-data", () => ({
  getWorldAIPrompt: vi.fn((id?: string) => {
    if (id === "earth") {
      return "这是一个与现代地球完全一致的世界，时间在2026年。";
    }
    return "";
  }),
}));

describe("SYSTEM_PROMPT_BASE", () => {
  it("应该是字符串", () => {
    expect(typeof SYSTEM_PROMPT_BASE).toBe("string");
  });

  it("应该包含 JSON", () => {
    expect(SYSTEM_PROMPT_BASE).toContain("JSON");
  });
});

describe("SYSTEM_PROMPT_CIVILIAN", () => {
  it("应该是字符串", () => {
    expect(typeof SYSTEM_PROMPT_CIVILIAN).toBe("string");
  });

  it("应该包含 写实", () => {
    expect(SYSTEM_PROMPT_CIVILIAN).toContain("写实");
  });
});

describe("buildSystemPrompt", () => {
  it("不传参数时应返回 SYSTEM_PROMPT_BASE", () => {
    const result = buildSystemPrompt();
    expect(result).toBe(SYSTEM_PROMPT_BASE);
  });

  it("传入存在的 worldId 应返回包含 world prompt 的结果", () => {
    const result = buildSystemPrompt("earth");
    expect(result).toContain(SYSTEM_PROMPT_BASE);
    expect(result).toContain("这是一个与现代地球完全一致的世界");
  });

  it("传入不存在的 worldId 应返回 SYSTEM_PROMPT_BASE", () => {
    const result = buildSystemPrompt("nonexistent");
    expect(result).toBe(SYSTEM_PROMPT_BASE);
  });
});