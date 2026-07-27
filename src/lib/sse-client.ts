/**
 * 浏览器端 SSE 消费工具（配合服务端的 createSSEResponse 契约）。
 * 只解析 data: 事件，绝不向用户暴露任何 JSON 骨架——叙事正文以 chunk 形式逐段回调。
 */

export interface SSEHandlers {
  onCommitted?: (data: any) => void;
  onChunk: (chunk: string) => void;
  onDone: (data: any) => void;
  onError: (err: any) => void;
}

export async function consumeNarrativeStream(res: Response, handlers: SSEHandlers): Promise<void> {
  if (!res.body) {
    handlers.onError(new Error("响应无正文"));
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        let json: any;
        try {
          json = JSON.parse(dataLine.slice(6));
        } catch {
          continue;
        }
        if ("committed" in json) handlers.onCommitted?.(json.committed);
        else if ("chunk" in json) handlers.onChunk(json.chunk);
        else if ("done" in json) handlers.onDone(json.result ?? json.done);
        else if ("error" in json) handlers.onError(json.error);
      }
    }
  } catch (e) {
    handlers.onError(e);
  }
}
