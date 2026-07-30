import { describe, it, expect, vi, beforeEach } from "vitest";
import { consumeNarrativeStream } from "../sse-client";

function makeStreamResponse(chunks: string[]): Response {
  let index = 0;
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index++;
    },
  });
  return { body: readable, ok: true } as Response;
}

function makeErrorResponse(): Response {
  return { body: null, ok: false } as Response;
}

describe("consumeNarrativeStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onError when response has no body", async () => {
    const onError = vi.fn();
    await consumeNarrativeStream(makeErrorResponse(), {
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError,
    });
    expect(onError).toHaveBeenCalledWith(new Error("响应无正文"));
  });

  it("calls onChunk for chunk events", async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: {"chunk":"你好"}\n\n', 'data: {"chunk":"世界"}\n\n']),
      { onChunk, onDone, onError: vi.fn() }
    );
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "你好");
    expect(onChunk).toHaveBeenNthCalledWith(2, "世界");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("calls onDone with result when done event arrives", async () => {
    const onDone = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: {"done":{"narrative":"完成"}}\n\n']),
      { onChunk: vi.fn(), onDone, onError: vi.fn() }
    );
    expect(onDone).toHaveBeenCalledWith({ narrative: "完成" });
  });

  it("calls onDone with result when done event arrives", async () => {
    const onDone = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: {"done":{"narrative":"完成"}}\n\n']),
      { onChunk: vi.fn(), onDone, onError: vi.fn() }
    );
    expect(onDone).toHaveBeenCalledWith({ narrative: "完成" });
  });

  it("calls onCommitted when committed event arrives", async () => {
    const onCommitted = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: {"committed":"c1"}\n\n']),
      { onChunk: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onCommitted }
    );
    expect(onCommitted).toHaveBeenCalledWith("c1");
  });

  it("calls onError when error event arrives", async () => {
    const onError = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: {"error":"出错了"}\n\n']),
      { onChunk: vi.fn(), onDone: vi.fn(), onError }
    );
    expect(onError).toHaveBeenCalledWith("出错了");
  });

  it("skips lines without data: prefix", async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['event: keepalive\ndata: {"chunk":"跳过"}\n\n']),
      { onChunk, onDone, onError: vi.fn() }
    );
    expect(onChunk).toHaveBeenCalledWith("跳过");
  });

  it("skips invalid JSON gracefully", async () => {
    const onChunk = vi.fn();
    const onError = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: not-json\n\n']),
      { onChunk, onDone: vi.fn(), onError }
    );
    expect(onChunk).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("handles multiple events in one chunk", async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: {"chunk":"A"}\n\ndata: {"chunk":"B"}\n\n']),
      { onChunk, onDone, onError: vi.fn() }
    );
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "A");
    expect(onChunk).toHaveBeenNthCalledWith(2, "B");
  });

  it("handles split events across chunks", async () => {
    const onChunk = vi.fn();
    await consumeNarrativeStream(
      makeStreamResponse(['data: {"chu', 'nk":"split"}\n\n']),
      { onChunk, onDone: vi.fn(), onError: vi.fn() }
    );
    expect(onChunk).toHaveBeenCalledWith("split");
  });

  it("calls onError on stream read error", async () => {
    const onError = vi.fn();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.error(new Error("网络错误"));
      },
    });
    await consumeNarrativeStream(
      { body: errorStream } as Response,
      { onChunk: vi.fn(), onDone: vi.fn(), onError }
    );
    expect(onError).toHaveBeenCalled();
  });
});