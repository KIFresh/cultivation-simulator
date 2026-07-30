// 内容安全过滤 —— 被 lib/__tests__/content-safety.test.ts 依赖（AI 叙事合规）。
// 重建依据：测试导入契约（scanText / guardUserPrompt / checkNarrativeSafe / safeReturn / ContentBlockedError）。

import { safeJsonParse } from "./json-helper";

export type SafetyLevel = "low" | "medium" | "high" | "critical";

export interface ScanResult {
  blocked: boolean;
  category: string;
  level: SafetyLevel;
  matched?: string;
}

export interface ScanOptions {
  minLevel?: SafetyLevel;
}

const LEVEL_RANK: Record<SafetyLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

interface Rule {
  category: string;
  level: SafetyLevel;
  word: string;
  re: RegExp;
}

const RULES: Rule[] = [
  { category: "porn", level: "critical", word: "色情", re: /色情|裸聊|淫|porn|做爱|性交/i },
  { category: "violence", level: "high", word: "杀", re: /杀|打死|屠杀|去死/i },
  { category: "selfharm", level: "high", word: "自残", re: /自残|自杀|自伤/i },
  { category: "gambling", level: "high", word: "赌博", re: /赌博|赌钱|博彩/i },
  { category: "insult", level: "medium", word: "傻逼", re: /傻逼|白痴|废物|垃圾/i },
];

export class ContentBlockedError extends Error {
  scan: ScanResult;
  constructor(scan: ScanResult) {
    super("内容被安全策略拦截");
    this.name = "ContentBlockedError";
    this.scan = scan;
  }
}

export function scanText(text: string | null | undefined, opts?: ScanOptions): ScanResult {
  const t = text ? String(text) : "";
  if (!t.trim()) {
    return { blocked: false, category: "", level: "low" };
  }
  const minRank = opts?.minLevel ? LEVEL_RANK[opts.minLevel] : 0;

  let best: Rule | null = null;
  for (const rule of RULES) {
    if (rule.re.test(t)) {
      if (!best || LEVEL_RANK[rule.level] > LEVEL_RANK[best.level]) best = rule;
    }
  }
  if (!best) {
    return { blocked: false, category: "", level: "low" };
  }
  const blocked = LEVEL_RANK[best.level] >= minRank;
  return {
    blocked,
    category: best.category,
    level: best.level,
    matched: best.word,
  };
}

export function guardUserPrompt(text: string): void {
  const r = scanText(text);
  if (r.blocked) throw new ContentBlockedError(r);
}

function extractNarrative(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const o = safeJsonParse(json, {} as Record<string, unknown>);
    return typeof o.narrative === "string" ? o.narrative : "";
  } catch {
    return "";
  }
}

/** 输出兜底：仅拦截 critical 档（修仙战斗描写属 high，不应误伤）。 */
export function checkNarrativeSafe(json: string | null | undefined): boolean {
  const narrative = extractNarrative(json);
  return !scanText(narrative, { minLevel: "critical" }).blocked;
}

export function safeReturn(json: string): string {
  if (!checkNarrativeSafe(json)) {
    throw new Error("GENERATED_CONTENT_BLOCKED");
  }
  return json;
}
