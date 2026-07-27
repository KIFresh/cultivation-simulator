// ============================================================
// 同学生成数据 — P0#3 好友系统（同学生成）
// 纯预制常量 + 纯函数，无 IO、无 AI、可单测。
// 仅由 advance-year 路由在 earth 世界观、6-15 岁且无同学时调用。
// ============================================================

/** 生成数量常量（用户拍板：精确 3，非 2-3 容差）。 */
export const CLASSMATE_MIN = 3;
export const CLASSMATE_MAX = 3;

/** 同学生成有效年龄窗口（含端点）。 */
export const CLASSMATE_AGE_MIN = 6;
export const CLASSMATE_AGE_MAX = 15;

/** 凡人化同学名字池（男女混合，≥20）。纯手写常量，禁用 AI 生成。 */
export const CLASSMATE_NAMES: string[] = [
  "小明", "小红", "阿强", "丽丽", "小刚", "小芳",
  "小军", "婷婷", "大壮", "小燕", "志强", "晓梅",
  "磊磊", "妞妞", "鹏飞", "小敏", "浩浩", "春花",
  "小杰", "玲玲", "建国", "佳佳", "铁柱", "小雪",
  "小龙", "可可",
];

/** 同学头像 emoji 池（纯装饰，可重复）。 */
export const CLASSMATE_AVATARS: string[] = ["🧒", "👦", "👧", "🧑", "👶"];

/** npcRelations 单条值结构（与 advance-year route 内联类型一致，额外含可选 type）。 */
export interface NpcRelationData {
  intimacy: number;
  avatar: string;
  realm: string;
  metAt: number;
  category: string;
  type?: string;
}

/** 同学稳定身份标记值。 */
export const CLASSMATE_TYPE = "classmate";

/**
 * 是否应当生成同学。
 * 仅判断「年龄窗口 6-15」与「relations 中尚无 type:classmate 条目」。
 * 世界观门控（earth）由调用方（advance-year 路由）负责。
 */
export function shouldGenerateClassmates(
  newAge: number,
  relations: Record<string, NpcRelationData>,
): boolean {
  const inWindow = newAge >= CLASSMATE_AGE_MIN && newAge <= CLASSMATE_AGE_MAX;
  const hasClassmate = Object.values(relations).some(
    (r) => r && r.type === CLASSMATE_TYPE,
  );
  return inWindow && !hasClassmate;
}

/** Fisher-Yates 洗牌（以 Math.random 为随机源，仅影响抽取顺序，不影响唯一性）。 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomAvatar(): string {
  return CLASSMATE_AVATARS[Math.floor(Math.random() * CLASSMATE_AVATARS.length)];
}

/**
 * 生成同学并合并回 relations 返回。
 * - 不满足条件时原样返回（幂等）。
 * - 从 CLASSMATE_NAMES 洗牌不放回取前 N 个唯一名字（N 由常量决定，本任务恒为 3）。
 * - 每条写入 { intimacy:0, avatar:随机emoji, realm:"凡人", metAt:newAge, category:"同窗", type:"classmate" }。
 * - 不修改入参（返回新对象），无副作用。
 */
export function generateClassmates(
  newAge: number,
  relations: Record<string, NpcRelationData>,
): Record<string, NpcRelationData> {
  if (!shouldGenerateClassmates(newAge, relations)) return relations;

  const count =
    CLASSMATE_MIN + Math.floor(Math.random() * (CLASSMATE_MAX - CLASSMATE_MIN + 1));
  const names = shuffle(CLASSMATE_NAMES).slice(0, count);

  const next: Record<string, NpcRelationData> = { ...relations };
  for (const name of names) {
    // 兜底去重：同世同批次靠不放回抽取已保证唯一；若异常重名则加序号后缀。
    let key = name;
    let suffix = 1;
    while (next[key]) {
      suffix += 1;
      key = `${name}${suffix}`;
    }
    next[key] = {
      intimacy: 0,
      avatar: randomAvatar(),
      realm: "凡人",
      metAt: newAge,
      category: "同窗",
      type: CLASSMATE_TYPE,
    };
  }
  return next;
}
