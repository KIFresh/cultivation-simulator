import { describe, it, expect, vi } from "vitest";
import { fetchStreamNarrative, cleanNarrativeStream, createStreamState } from "../stream-client";

describe("stream-client", () => {
  describe("cleanNarrativeStream", () => {
    it("should return raw text as-is", () => {
      expect(cleanNarrativeStream("hello world")).toBe("hello world");
    });

    it("should strip leading code fences", () => {
      const input = '```json\n{"narr": "test"}';
      expect(cleanNarrativeStream(input)).toBe("test");
    });

    it("should strip leading thinking tags", () => {
      const input = "<thinking>\n正文内容";
      expect(cleanNarrativeStream(input)).toBe("正文内容");
    });

    it("should extract narr field from JSON", () => {
      const input = '{"narr": "修炼感悟"}';
      expect(cleanNarrativeStream(input)).toBe("修炼感悟");
    });

    it("should return empty string for empty input", () => {
      expect(cleanNarrativeStream("")).toBe("");
    });
  });

  describe("fetchStreamNarrative", () => {
    it("should return error when fetch fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const result = await fetchStreamNarrative("/api/narrative", {});
      expect(result.narrativeError).toBeDefined();
      expect(result.narrativeError!.code).toBe("STREAM_ERROR");
    });

    it("should return HTTP error for non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        json: vi.fn().mockResolvedValue({
          code: "EMPTY_RESPONSE",
          error: "AI 叙事服务返回了空内容，请重试或更换模型",
        }),
      });
      const result = await fetchStreamNarrative("/api/narrative", {});
      expect(result.narrativeError).toBeDefined();
      expect(result.narrativeError!.code).toBe("EMPTY_RESPONSE");
      expect(result.narrativeError!.message).toContain("空内容");
    });
  });

  describe("createStreamState", () => {
    it("should start with empty text", () => {
      const state = createStreamState();
      expect(state.text).toBe("");
    });

    it("should append text and notify listeners", () => {
      const state = createStreamState();
      const listener = vi.fn();
      state.subscribe(listener);
      state.append("hello");
      expect(state.text).toBe("hello");
      expect(listener).toHaveBeenCalledWith("hello");
    });

    it("should reset text", () => {
      const state = createStreamState();
      state.append("some text");
      state.reset();
      expect(state.text).toBe("");
    });
  });
});
