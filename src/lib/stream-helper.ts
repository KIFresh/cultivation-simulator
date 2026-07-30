/**
 * SSE (Server-Sent Events) 流式响应工具
 * 将 AsyncGenerator<string> 包装为 SSE ReadableStream Response
 */

/**
 * 将一段叙事文本切分为适合逐字流式播放的块。
 * 优先按句末标点断句，过长句子再按 ~20 字细切；绝不破坏文本结构。
 */
export function chunkNarrative(text: string): string[] {
  if (!text) return [];
  const sentences = text.split(/(?<=[。！？\n])/);
  const chunks: string[] = [];
  for (const s of sentences) {
    const piece = s.replace(/\n/g, "");
    if (!piece.trim()) continue;
    if (piece.length <= 24) {
      chunks.push(piece);
      continue;
    }
    let i = 0;
    while (i < piece.length) {
      chunks.push(piece.slice(i, i + 12));
      i += 12;
    }
  }
  return chunks;
}

/**
 * 将文本 AsyncGenerator 包装为 SSE Response
 * @param generator - 文本生成器，逐块产出文本
 * @param onComplete - 流结束后执行，返回值作为 done 事件的 data
 */
export function createSSEResponse<T>(
  generator: AsyncGenerator<string>,
  onComplete?: (fullText: string) => Promise<T> | T,
  committed?: unknown,
  onError?: (err: unknown) => unknown
): Response {
  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 提交优先：占位事件已落库后，先发 committed 事件（乐观载荷 + gameEventId）
        if (committed !== undefined) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ committed })}\n\n`));
        }
        for await (const chunk of generator) {
          fullText += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
        }
        // 流结束，执行回调并发送 done 事件
        if (onComplete) {
          const result = await onComplete(fullText);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result })}\n\n`));
        } else {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`)
          );
        }
      } catch (err) {
        const msg = (err as Error).message || String(err);
        try {
          if (onError) {
            const narrativeError = onError(err);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: { narrativeError } })}\n\n`)
            );
          } else {
            // 向后兼容：未传 onError 时回落为字符串 error（保留 stream.test.ts 旧断言）
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          }
        } catch {
          /* ignore */
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
