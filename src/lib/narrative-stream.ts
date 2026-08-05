/**
 * 服务端叙事流式统一封装。
 * 契约（与 tests/stream-route.test.ts 对齐）：
 *  - 首个事件 committed：{ gameEventId, cultivator? }
 *  - 中间事件 chunk：{ chunk }（仅叙事正文，绝不携带 JSON 骨架）
 *  - 结束事件 done：{ done: true, result }（回填完整叙事对象 + 业务载荷）
 *  - 异常事件 error：{ error: { gameEventId, message } }（供前端重试复用锚点）
 */

import { createSSEResponse, chunkNarrative } from "./stream-helper";

/**
 * AI 流式叙事 SSE：AI 边生成边把 narrative 正文推给前端（真流式）。
 * - run 回调内调用 AI（传 onDelta），onDelta 喂 extractor 提取 narrative 增量
 * - AI 完成后 run 返回 { result }（事务结果），作为 done 事件载荷
 * - 无 committed 事件（AI 完成前没有 gameEventId；前端不消费 committed）
 */
export function streamAIJob(opts: {
  run: (onDelta: (t: string) => void) => Promise<{ result: unknown }>;
  errorMessage?: string;
}): Response {
  const extractor = createNarrativeExtractor();
  const queue: string[] = [];
  let waiter: (() => void) | null = null;
  let finished = false;
  let aiError: unknown = null;
  let doneResult: unknown = null;

  const notify = () => {
    const w = waiter;
    waiter = null;
    w?.();
  };

  const job = (async () => {
    try {
      const { result } = await opts.run((d) => {
        const inc = extractor.push(d);
        if (inc) {
          queue.push(inc);
          notify();
        }
      });
      doneResult = result;
    } catch (e) {
      aiError = e;
      // 服务端日志保留真实错误，响应端只发脱敏 message
      console.error("[streamAIJob] failed:", e instanceof Error ? e.stack : e);
    }
    finished = true;
    notify();
  })();

  const encoder = new TextEncoder();
  // 供前端 onError 自动附加 requestId（consumeNarrativeStream 从响应头读取）
  const requestId = crypto.randomUUID();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          while (true) {
            while (queue.length) send({ chunk: queue.shift() });
            if (finished) break;
            await new Promise<void>((r) => {
              waiter = r;
            });
          }
          await job;
          if (aiError) throw aiError;
          send({ done: true, result: doneResult });
        } catch {
          send({
            error: {
              narrativeError: {
                message: opts.errorMessage || "叙事生成失败，请稍后重试",
                code: "NARRATIVE_FAILED",
              },
            },
          });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "x-request-id": requestId,
      },
    }
  );
}

/**
 * 从 AI 流式增量中提取 narrative 字段的增量文本。
 * 维护 buffer，每次调用返回"自上次以来 narrative 值新增的部分"。
 * 尽力提取：narrative 值未闭合也返回当前累积部分（AI 按序生成，narrative 值
 * 闭合前不会出现后续字段；转义 `\"` 已处理）。配合前端逐字流式显示。
 */
export function createNarrativeExtractor() {
  let buffer = "";
  let lastLen = 0;
  return {
    push(delta: string): string {
      buffer += delta;
      const m = buffer.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)/);
      if (!m) return "";
      const narr = m[1];
      if (narr.length <= lastLen) return "";
      const inc = narr.slice(lastLen);
      lastLen = narr.length;
      return inc;
    },
  };
}

export function streamNarrativeResult(
  eventId: string,
  narrative: { narrative?: string } | null,
  doneResult: unknown,
  cultivator?: unknown
) {
  const gen = (async function* () {
    for (const c of chunkNarrative(narrative?.narrative || "")) {
      yield c;
      // 关键：每个 chunk 之间让出事件循环，强制 ReadableStream 分批 flush 到网络。
      // 否则所有 chunk 会在同一微任务批次被一次性 enqueue，浏览器一次性收到，
      // 前端虽逐事件 onChunk 却挤在同一帧内 set 完 → 失去"逐字/逐段"流式观感。
      await new Promise((r) => setTimeout(r, 18));
    }
  })();

  const committed = {
    gameEventId: eventId,
    cultivator: cultivator ?? null,
    characterName:
      cultivator &&
      typeof cultivator === "object" &&
      "name" in (cultivator as Record<string, unknown>)
        ? ((cultivator as Record<string, unknown>).name as string)
        : undefined,
  };

  return createSSEResponse(
    gen,
    () => doneResult,
    committed,
    (err: unknown) => ({
      gameEventId: eventId,
      type: "NARRATIVE",
      code: err instanceof Error && err.message.includes("返回内容为空")
        ? "EMPTY_RESPONSE"
        : "NARRATIVE_FAILED",
      message: err instanceof Error && err.message.includes("返回内容为空")
        ? "AI 叙事服务返回了空内容，请重试或更换模型"
        : "出生叙事生成失败，请稍后重试",
    })
  );
}
