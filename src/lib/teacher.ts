// ============================================================
// 师长关系 — P1#7
// 纯函数，无 IO、无 AI、可单测。
// 仅由 advance-quarter 路由在 earth 世界观、6 岁边界且无 teacher 时调用生成；
// getTeacherRankBonus 用于年推进算 schoolRank 时对学校档位加权。
// ============================================================

import type { NpcRelationData } from "./classmate-data";

/** 师长稳定身份标记值。 */
export const TEACHER_TYPE = "teacher";

/** 老师名字池（姓氏+称谓，凡人化）。纯手写常量，禁用 AI 生成。 */
export const TEACHER_NAMES: string[] = [
  "王导师",
  "李夫子",
  "张老师",
  "陈先生",
  "赵师母",
  "周教习",
  "吴先生",
  "郑师傅",
  "孙老师",
  "钱夫子",
];

/** 生成数量常量（手拍板：1-2 名）。 */
export const TEACHER_MIN = 1;
export const TEACHER_MAX = 2;

/** 师长头像 emoji 池（纯装饰，可重复）。 */
export const TEACHER_AVATARS: string[] = ["🧑‍🏫", "👨‍🏫", "👩‍🏫", "🧓"];

/**
 * 是否应当生成老师。
 * 仅判断「年龄窗口 ≥6（入学）」与「relations 中尚无 type:teacher 条目」。
 * 世界观门控（earth）由调用方（advance-quarter 路由）负责。
 */
export function shouldGenerateTeachers(
  newAge: number,
  relations: Record<string, NpcRelationData>
): boolean {
  const inWindow = newAge >= 6;
  const hasTeacher = Object.values(relations).some((r) => r && r.type === TEACHER_TYPE);
  return inWindow && !hasTeacher;
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
  return TEACHER_AVATARS[Math.floor(Math.random() * TEACHER_AVATARS.length)];
}

/**
 * 生成老师并合并回 relations 返回。
 * - 不满足条件时原样返回（幂等）。
 * - 从 TEACHER_NAMES 洗牌不放回取前 N 个唯一名字（N = 1~2）。
 * - 每条写入 { intimacy:0, avatar:随机emoji, realm:"凡人", metAt:newAge, category:"师长", type:"teacher" }。
 * - 不修改入参（返回新对象），无副作用。
 */
export function generateTeachers(
  newAge: number,
  relations: Record<string, NpcRelationData>
): Record<string, NpcRelationData> {
  if (!shouldGenerateTeachers(newAge, relations)) return relations;

  const count = TEACHER_MIN + Math.floor(Math.random() * (TEACHER_MAX - TEACHER_MIN + 1));
  const names = shuffle(TEACHER_NAMES).slice(0, count);

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
      category: "师长",
      type: TEACHER_TYPE,
    };
  }
  return next;
}

/** 师长好感对学校档位的加权阈值：最高老师好感达到该值则加权一档。 */
export const TEACHER_RANK_BONUS_THRESHOLD = 70;

/**
 * 师长好感对学校档位的加权值。
 * 取所有 type:"teacher" 条目中的最高 intimacy；
 * 若 ≥ 阈值则返回 +1（封顶由调用方 clamp），否则返回 0。
 */
export function getTeacherRankBonus(relations: Record<string, NpcRelationData>): number {
  const teachers = Object.values(relations).filter((r) => r && r.type === TEACHER_TYPE);
  if (teachers.length === 0) return 0;
  const maxIntimacy = Math.max(...teachers.map((t) => t.intimacy || 0));
  return maxIntimacy >= TEACHER_RANK_BONUS_THRESHOLD ? 1 : 0;
}
