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
          typeof (x as { terms?: unknown }).terms === "number"
      );
    }
  } catch {
    // ignore
  }
  return [];
}

/** 每学期每个班给出的属性点 */
export const CLASS_ATTR_BONUS = 1;

/** 年费：从 gold 中扣除 */
const CLASS_ANNUAL_FEE_KEY = "classFees";

/** 计算所有已报名课外班的年度属性加成与总费用 */
export function applyClassBenefits(
  records: ClassEnrollRecord[],
  attributes: Record<string, number>
): { attributes: Record<string, number>; totalCost: number } {
  let totalCost = 0;
  const out = { ...attributes };
  for (const r of records) {
    const opt = CLASS_ENROLL_OPTIONS.find((o) => o.id === r.optionId);
    if (!opt) continue;
    totalCost += opt.cost;
    out[opt.attr] = (out[opt.attr] ?? 0) + CLASS_ATTR_BONUS * r.terms;
  }
  return { attributes: out, totalCost };
}

/** 判断某年龄是否能上某类课外班 */
export function canEnrollClass(
  age: number,
  optionId: string,
  records: ClassEnrollRecord[]
): boolean {
  if (age < 6 || age > 18) return false;
  const opt = CLASS_ENROLL_OPTIONS.find((o) => o.id === optionId);
  if (!opt) return false;
  if (records.some((r) => r.optionId === optionId)) return false; // 已报名
  return true;
}

/** 报名 / 续报一个兴趣班，返回更新后的报名记录。 */
export function enrollClass(current: ClassEnrollRecord[], optionId: string): ClassEnrollRecord[] {
  const existing = current.find((c) => c.optionId === optionId);
  if (existing) {
    return current.map((c) => (c.optionId === optionId ? { ...c, terms: c.terms + 1 } : c));
  }
  return [...current, { optionId, terms: 1 }];
}
