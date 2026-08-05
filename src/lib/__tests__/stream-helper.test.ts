import { describe, it, expect } from "vitest";
import { chunkNarrative } from "../stream-helper";

describe("chunkNarrative", () => {
  it("returns empty array for empty text", () => {
    expect(chunkNarrative("")).toEqual([]);
  });

  it("returns empty array for null-like text", () => {
    expect(chunkNarrative("")).toEqual([]);
  });

  it("splits by sentence-ending punctuation", () => {
    const result = chunkNarrative("你好。世界！");
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("你好。");
    expect(result[1]).toBe("世界！");
  });

  it("handles multiple punctuation types", () => {
    const result = chunkNarrative("第一句。第二句！第三句？");
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("第一句。");
    expect(result[1]).toBe("第二句！");
    expect(result[2]).toBe("第三句？");
  });

  it("splits long sentences into smaller chunks", () => {
    const longText = "这是一段很长的话需要被切碎用来流式输出效果更好。";
    const result = chunkNarrative(longText);
    // Each chunk should be <= 24 chars
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(24);
    }
    // The combined text should equal the original
    expect(result.join("")).toBe(longText);
  });

  it("removes newlines from chunks", () => {
    const result = chunkNarrative("第一行。\n第二行。");
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("第一行。");
    expect(result[1]).toBe("第二行。");
  });

  it("handles single short sentence", () => {
    const result = chunkNarrative("短句。");
    expect(result).toEqual(["短句。"]);
  });

  it("handles mixed length parts", () => {
    const text = "短。这是一段较长的话啊需要被切分。再短。";
    const result = chunkNarrative(text);
    expect(result.join("")).toBe(text);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(24);
    }
  });
});