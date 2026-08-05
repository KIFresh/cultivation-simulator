// ═══════════════════════════════════════════════════════════════════════════
// narrative-json.ts — 严格 JSON 提取器
// ═══════════════════════════════════════════════════════════════════════════
// 功能：
// 1. 严格 JSON 提取（解析失败返回 null + 错误信息，不静默 fallback）
// 2. 保持原有 extractJson 作为宽松 fallback 路径
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 严格 JSON 提取结果。
 * 成功时 result 为解析后的对象，失败时 errors 包含错误信息。
 */
export interface StrictParseResult {
  result: unknown | null;
  errors: string[];
}

/**
 * 从 AI 响应文本中严格提取 JSON 对象。
 * 与 extractJson 不同，此函数在解析失败时返回 null + 错误信息，
 * 不会静默返回 fallback 默认值。
 */
export function strictExtractJson(text: string): StrictParseResult {
  const errors: string[] = [];

  // 1. 直接解析
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { result: parsed, errors: [] };
    }
    errors.push("直接解析结果不是对象");
  } catch {
    errors.push("直接解析失败");
  }

  // 2. 从 markdown 代码块中提取
  try {
    const m = text.match(/```(?:json)?\s*(\{[\s\S]*?\})(?:\s*```|$)/);
    if (m) {
      const parsed = JSON.parse(m[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { result: parsed, errors: [] };
      }
      errors.push("Markdown 代码块解析结果不是对象");
    } else {
      errors.push("未找到 Markdown JSON 代码块");
    }
  } catch {
    errors.push("Markdown 代码块解析失败");
  }

  // 3. 括号计数法
  try {
    let depth = 0;
    let start = -1;
    let inString = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start >= 0) {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return { result: parsed, errors: [] };
          }
          errors.push("括号提取结果不是对象");
          break;
        }
      }
    }
    if (depth !== 0 || start === -1) {
      errors.push("括号计数法未找到闭合的 JSON 对象");
    }
  } catch {
    errors.push("括号提取解析失败");
  }

  return { result: null, errors };
}

/**
 * 从 AI 响应文本中提取 JSON，并校验 Schema。
 * 解析或 Schema 校验失败时返回 null + 错误信息。
 */
export function strictExtractAndValidate<T>(
  text: string,
  validator: (data: unknown) => { success: boolean; data?: T; errors: string[] }
): { success: boolean; data?: T; errors: string[] } {
  const { result, errors: parseErrors } = strictExtractJson(text);
  if (!result) {
    return { success: false, errors: parseErrors };
  }

  return validator(result);
}
