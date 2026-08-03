import { describe, it, expect } from "vitest";
import { streamAIJob } from "../narrative-stream";

/** 读取 SSE Response 全部事件，返回 [{type, data}] */
async function collectEvents(res: Response): Promise<Array<{ type: string; data: unknown }>> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const events: Array<{ type: string; data: unknown }> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const json = JSON.parse(line.slice(6));
        if ("chunk" in json) events.push({ type: "chunk", data: json.chunk });
        else if ("done" in json) events.push({ type: "done", data: json.result });
        else if ("error" in json) events.push({ type: "error", data: json.error });
      } catch {
        /* 忽略非法行 */
      }
    }
  }
  // 尾部残留
  const line = buf.trim().split("\n").find((l) => l.startsWith("data: "));
  if (line) {
    try {
      const json = JSON.parse(line.slice(6));
      if ("chunk" in json) events.push({ type: "chunk", data: json.chunk });
      else if ("done" in json) events.push({ type: "done", data: json.result });
      else if ("error" in json) events.push({ type: "error", data: json.error });
    } catch {
      /* ignore */
    }
  }
  return events;
}

describe("streamAIJob", () => {
  it("AI 增量按序推送 chunk，完成后发 done 载荷", async () => {
    const res = streamAIJob({
      run: async (onDelta) => {
        onDelta('{"type":"DAILY","title":"修炼","narrative":"你好，');
        onDelta("世界。");
        onDelta('","mood":"静"}');
        return { result: { eventId: "evt-1", narrative: "你好，世界。" } };
      },
    });
    const events = await collectEvents(res);
    expect(events.map((e) => e.type)).toEqual(["chunk", "chunk", "done"]);
    expect(events[0].data).toBe("你好，");
    expect(events[1].data).toBe("世界。");
    expect(events[2].data.eventId).toBe("evt-1");
  });

  it("无 narrative 时只发 done", async () => {
    const res = streamAIJob({
      run: async () => ({ result: { ok: true } }),
    });
    const events = await collectEvents(res);
    expect(events.map((e) => e.type)).toEqual(["done"]);
    expect(events[0].data.ok).toBe(true);
  });

  it("AI 抛错时发 error 事件（不泄露原始错误）", async () => {
    const res = streamAIJob({
      run: async (onDelta) => {
        onDelta('{"narrative":"部分内容');
        throw new Error("HTTP 401 secret-detail");
      },
      errorMessage: "叙事生成失败，请稍后重试",
    });
    const events = await collectEvents(res);
    expect(events.map((e) => e.type)).toEqual(["chunk", "error"]);
    const err = events[1].data.narrativeError ?? events[1].data;
    expect(err.message).toBe("叙事生成失败，请稍后重试");
    // 原始错误细节不得出现在响应中
    expect(JSON.stringify(events[1].data)).not.toContain("secret-detail");
  });

  it("多个 AI 增量跨字段时只提取 narrative 部分", async () => {
    const res = streamAIJob({
      run: async (onDelta) => {
        onDelta('{"type":"DAILY","title":"晨修","narrative":"深吸一口气，');
        onDelta("引气入体。");
        onDelta('","mood":"悟","effects":[]}');
        return { result: {} };
      },
    });
    const events = await collectEvents(res);
    // 只有 narrative 增量作为 chunk；title/mood/effects 等 JSON 骨架绝不外泄
    expect(events.map((e) => e.type)).toEqual(["chunk", "chunk", "done"]);
    expect(events[0].data).toBe("深吸一口气，");
    expect(events[1].data).toBe("引气入体。");
    expect(JSON.stringify(events)).not.toContain("晨修");
    expect(JSON.stringify(events)).not.toContain("mood");
  });
});
