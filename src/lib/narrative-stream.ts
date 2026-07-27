/**
 * 服务端叙事流式统一封装。
 * 契约（与 tests/stream-route.test.ts 对齐）：
 *  - 首个事件 committed：{ gameEventId, cultivator? }
 *  - 中间事件 chunk：{ chunk }（仅叙事正文，绝不携带 JSON 骨架）
 *  - 结束事件 done：{ done: true, result }（回填完整叙事对象 + 业务载荷）
 *  - 异常事件 error：{ error: { gameEventId, message } }（供前端重试复用锚点）
 */

import { createSSEResponse, chunkNarrative } from "./stream-helper";

export function streamNarrativeResult(
  eventId: string,
  narrative: { narrative?: string } | null,
  doneResult: unknown,
  cultivator?: unknown,
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

  const committed = { gameEventId: eventId, cultivator: cultivator ?? null };

  return createSSEResponse(
    gen,
    () => doneResult,
    committed,
    (err: unknown) => ({
      gameEventId: eventId,
      message: err instanceof Error ? err.message : String(err),
    }),
  );
}
