// ============================================================
// 修仙模拟器 — 流式叙事客户端
// 解析 /api/narrative 的 SSE 响应，逐块回调清洗后的叙事文本，
// 并在结束时返回结构化结果（narrative / characterName / narrativeError）。
// ============================================================

export type NarrativeErrorPayload = {
  type: string;
  code: string;
  message: string;
  gameEventId: string | null;
  params?: unknown;
};

export interface NarrativeData {
  characterName?: string;
  narrativeError?: NarrativeErrorPayload;
  [key: string]: unknown;
}

export interface NarrativeResult {
  narrative?: NarrativeData;
  narrativeError?: NarrativeErrorPayload;
  characterName?: string;
}

interface StreamChunk {
  text?: string;
  characterName?: string;
  narrative?: NarrativeData;
  narrativeError?: NarrativeErrorPayload;
  committed?: { gameEventId?: string; characterName?: string };
  done?: { result: unknown };
  fullText?: string;
  error?: unknown;
}

/**
 * 调用流式叙事接口并解析 SSE 流。
 * @param url  例如 "/api/narrative?stream=true"
 * @param body 请求体（会被 JSON 序列化）
 * @param opts onChunk 在每收到一段清洗后的叙事文本时回调；signal 用于中止
 */
export async function fetchStreamNarrative(
  url: string,
  body: unknown,
  opts?: {
    onChunk?: (text: string) => void;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  }
): Promise<NarrativeResult> {
  const result: NarrativeResult = {};
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...opts?.headers },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    if (!res.ok || !res.body) {
      const payload = await res.json().catch(() => null) as {
        error?: string;
        code?: string;
      } | null;
      return {
        narrativeError: {
          type: "HTTP",
          code: payload?.code || "HTTP_" + (res?.status ?? 0),
          message: payload?.error || "叙事服务响应异常",
          gameEventId: null,
          params: body,
        },
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let chunk: StreamChunk | null = null;
          try {
            chunk = JSON.parse(payload) as StreamChunk;
          } catch {
            // 非 JSON 的原始文本块，直接作为清洗后文本回吐
            opts?.onChunk?.(cleanNarrativeStream(payload));
            continue;
          }
          if (chunk.text != null) {
            opts?.onChunk?.(cleanNarrativeStream(chunk.text));
          }
          if (chunk.characterName) result.characterName = chunk.characterName;
          if (chunk.committed?.characterName) result.characterName = chunk.committed.characterName;
          if (chunk.narrative) {
            result.narrative = { ...(result.narrative ?? {}), ...chunk.narrative };
            if (chunk.narrative.characterName) {
              result.characterName = chunk.narrative.characterName;
            }
          }
          if (chunk.narrativeError) {
            result.narrativeError = chunk.narrativeError;
          }
          if (chunk.done && chunk.done.result) {
            // done 事件携带完整业务载荷，合并到 result.narrative
            const doneResult = chunk.done.result as Record<string, unknown>;
            result.narrative = { ...(result.narrative ?? {}), ...doneResult };
            if (doneResult.characterName) {
              result.characterName = doneResult.characterName as string;
            }
            continue;
          }
          if (chunk.error) {
            const errMsg =
              typeof chunk.error === "string"
                ? chunk.error
                : (chunk.error as Record<string, unknown>)?.message;
            if (!result.narrativeError) {
              result.narrativeError = {
                type: "STREAM",
                code: "STREAM_ERROR",
                message: typeof errMsg === "string" ? errMsg : "叙事流异常",
                gameEventId: null,
                params: body,
              };
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (result.narrativeError) {
      return {
        narrativeError: result.narrativeError,
        characterName: result.characterName,
      };
    }
    return {
      narrative: result.narrative,
      characterName: result.characterName,
    };
  } catch (err) {
    const ne = extractNarrativeError(err);
    if (ne) {
      return { narrativeError: ne, characterName: result.characterName };
    }
    return {
      narrativeError: {
        type: "STREAM",
        code: "STREAM_ERROR",
        message: err instanceof Error ? err.message : String(err),
        gameEventId: null,
        params: body,
      },
      characterName: result.characterName,
    };
  }
}

/** 从 SSE error 事件或 HTTP 错误体提取结构化 narrativeError */
function extractNarrativeError(source: unknown): NarrativeErrorPayload | null {
  const e = source as any;
  if (e?.error?.narrativeError) return e.error.narrativeError as NarrativeErrorPayload;
  if (typeof e?.error === "string")
    return { type: "STREAM", code: "STREAM_ERROR", message: e.error, gameEventId: null };
  if (e?.narrativeError) return e.narrativeError as NarrativeErrorPayload;
  return null;
}

/**
 * 流式叙事预览清洗：
 *   1) 剥离开头的代码栅栏 / 函数标签 / 思考标签 及其结尾闭合
 *   2) 检测剩余文本是否为 JSON 对象；若是，提取 narr / narrative 字段值作为展示文本
 *
 * 设计要点：
 * - 在「上一累积值 + 新块」整体重洗，而非逐块清洗——这样即使开头的栅栏被网络分块切断
 *   （如首块为 ```json、次块才是 \n{...），栅栏补全后整串重洗即可去掉，不会残留前缀。
 * - 仅剥「开头」与「结尾」的标签；正文中间的同类字符不受影响。
 * - 落库叙事由 extractJson 的括号计数法单独处理（只取 {…} 内），与此处解耦。
 * - JSON 提取：AI 模型常输出 {"type":"ACTION","narr":"...","mood":"静"} 格式的流式文本，
 *   逐 token 拼接后用户会看到原始 JSON 骨架。本步骤在 JSON 可解析时提取 narr/narrative 字段，
 *   让流式预览直接展示可读叙事正文。JSON 不完整时（流中途）静默回退到已清洗文本。
 */
const LEADING_FENCE = /^\s*```[a-zA-Z]*\s*(?:\n|(?=\{))|^\s*~~~[a-zA-Z]*\s*(?:\n|(?=\{))/;
const LEADING_TAG =
  /^\s*<(?:function_calls?|function|tool_call|tool_use|think|thinking)\b[^>]*>\s*/i;
const TRAILING_FENCE = /\s*(?:```|~~~)\s*$/;
const TRAILING_TAG = /\s*<\/(?:function_calls?|function|tool_call|tool_use|think|thinking)>\s*$/i;

/** 尝试从类 JSON 文本中提取 narr / narrative 字段；失败返回 null */
function tryExtractNarrativeFromJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === "object") {
      const narr = obj.narr ?? obj.narrative ?? obj.content ?? null;
      if (typeof narr === "string" && narr.trim().length > 0) return narr;
    }
  } catch {
    /* JSON 不完整或非法，静默回退 */
  }
  return null;
}

export function cleanNarrativeStream(raw: string): string {
  if (!raw) return raw;
  let s = raw;
  // 反复剥离开头标签（可能嵌套：标签后又紧跟栅栏）
  for (let i = 0; i < 8; i++) {
    const next = s.replace(LEADING_FENCE, "").replace(LEADING_TAG, "");
    if (next === s) break;
    s = next;
  }
  s = s.replace(TRAILING_FENCE, "").replace(TRAILING_TAG, "");
  // 尝试从 JSON 对象中提取可读叙事文本
  const extracted = tryExtractNarrativeFromJson(s);
  if (extracted !== null) return extracted;
  return s;
}

/**
 * 简化的 hook 风格：管理叙事文本的状态
 */
export function createStreamState() {
  let accumulatedText = "";
  const listeners = new Set<(text: string) => void>();

  return {
    get text() {
      return accumulatedText;
    },
    subscribe(fn: (text: string) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    append(chunk: string) {
      accumulatedText += chunk;
      listeners.forEach((fn) => fn(accumulatedText));
    },
    reset() {
      accumulatedText = "";
      listeners.forEach((fn) => fn(""));
    },
  };
}
