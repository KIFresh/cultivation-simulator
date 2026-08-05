import { describe, it, expect, vi } from "vitest";
import { streamNarrativeResult } from "../narrative-stream";

// Mock stream-helper to avoid creating actual ReadableStream
vi.mock("../stream-helper", () => ({
  chunkNarrative: vi.fn((text: string) => {
    if (!text) return [];
    return text.split("").map((c: string) => c);
  }),
  createSSEResponse: vi.fn(
    (
      _generator: any,
      onComplete?: (fullText: string) => unknown,
      committed?: unknown,
      onError?: (err: unknown) => unknown
    ) => ({ _generator, onComplete, committed, onError, mock: true })
  ),
}));

describe("streamNarrativeResult", () => {
  it("calls createSSEResponse with correct committed event", () => {
    const result = streamNarrativeResult(
      "event-1",
      { narrative: "测试叙事" },
      { narrative: "完成" },
      { id: "c1", name: "测试角色" }
    );

    expect(result).toHaveProperty("mock", true);
    expect(result.committed).toEqual({
      gameEventId: "event-1",
      cultivator: { id: "c1", name: "测试角色" },
      characterName: "测试角色",
    });
  });

  it("sets characterName from cultivator", () => {
    const result = streamNarrativeResult("e1", null, {}, { name: "张三" });
    expect(result.committed.characterName).toBe("张三");
  });

  it("handles cultivator without name", () => {
    const result = streamNarrativeResult("e1", null, {}, { id: "c1" });
    expect(result.committed.characterName).toBeUndefined();
  });

  it("handles null cultivator", () => {
    const result = streamNarrativeResult("e1", null, {}, null);
    // committed should have cultivator === null
    expect(result.committed.cultivator).toBeNull();
    expect(result.committed.characterName).toBeUndefined();
  });

  it("passes doneResult as onComplete callback result", async () => {
    const doneResult = { narrative: "完成叙事" };
    const result = streamNarrativeResult("e1", null, doneResult, null);

    // onComplete should return the doneResult
    const onCompleteResult = result.onComplete();
    expect(onCompleteResult).toBe(doneResult);
  });

  it("passes error handler that formats error with gameEventId", () => {
    const result = streamNarrativeResult("e1", null, {}, null);
    const errorObj = result.onError(new Error("出错了"));
    expect(errorObj).toEqual({
      gameEventId: "e1",
      type: "NARRATIVE",
      code: "NARRATIVE_FAILED",
      message: "出生叙事生成失败，请稍后重试",
    });
  });

  it("handles non-Error errors in onError", () => {
    const result = streamNarrativeResult("e1", null, {}, null);
    const errorObj = result.onError("字符串错误");
    expect(errorObj).toEqual({
      gameEventId: "e1",
      type: "NARRATIVE",
      code: "NARRATIVE_FAILED",
      message: "出生叙事生成失败，请稍后重试",
    });
  });
});