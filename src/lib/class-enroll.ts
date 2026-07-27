// 课外班：报名兴趣班，年复一年锤炼心性。
// 该模块对应的 API 路由由其他流程维护；此处提供自洽数据。

export interface ClassEnrollOption {
  id: string;
  name: string;
  attr: string;
  cost: number;
  desc: string;
}

export const CLASS_ENROLL_OPTIONS: ClassEnrollOption[] = [
  { id: "calligraphy", name: "书法班", attr: "mind", cost: 100, desc: "一笔一划，磨性子。" },
  { id: "martial", name: "武术班", attr: "root", cost: 150, desc: "扎马步，练筋骨。" },
  { id: "math", name: "奥数班", attr: "insight", cost: 120, desc: "烧脑逻辑，练悟性。" },
  { id: "music", name: "琴艺班", attr: "charm", cost: 110, desc: "弦音养气，增魅力。" },
  { id: "english", name: "外语班", attr: "luck", cost: 90, desc: "开阔眼界，添气运。" },
];

export interface ClassEnrollRecord {
  optionId: string;
  terms: number;
}

export function getClassEnrollOptions(): ClassEnrollOption[] {
  return CLASS_ENROLL_OPTIONS;
}

export function parseClassEnroll(raw: string | null | undefined): ClassEnrollRecord[] {
  if (!raw) return [];
  try {
    const p: unknown = JSON.parse(raw);
    if (Array.isArray(p)) {
      return p.filter(
        (x): x is ClassEnrollRecord =>
          !!x &&
          typeof x === "object" &&
          typeof (x as { optionId?: unknown }).optionId === "string" &&
          typeof (x as { terms?: unknown }).terms === "number",
      );
    }
  } catch {
    // ignore
  }
  return [];
}

/** 报名 / 续报一个兴趣班，返回更新后的报名记录。 */
export function enrollClass(
  current: ClassEnrollRecord[],
  optionId: string,
): ClassEnrollRecord[] {
  const existing = current.find((c) => c.optionId === optionId);
  if (existing) {
    return current.map((c) => (c.optionId === optionId ? { ...c, terms: c.terms + 1 } : c));
  }
  return [...current, { optionId, terms: 1 }];
}
