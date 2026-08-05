// 竞赛系统：每年上/下学期各 1 轮，学科等级门槛，三等制产出。
// 被 advance-quarter（触发）与 resolve-event（结算）使用。

export interface CompetitionPrize {
  name: string;
  subjectExp: number;
  insightExp: number;
  charmExp: number;
}

export interface CompetitionEvent {
  id: string;
  subject: string;
  subjectName: string;
  /** 学科等级门槛：低于该等级不可参加该科竞赛 */
  minLevel: number;
  prizes: CompetitionPrize[];
}

export type SubjectExpMap = Record<string, { exp: number; level: number }>;

// 学科解锁年龄（与 DAILY_ACTIVITIES 档位一致）
export const SUBJECT_UNLOCK_AGE: Record<string, number> = {
  math: 6,
  chinese: 6,
  english: 6,
  pe: 6,
  history: 12,
  physics: 12,
  chemistry: 15,
};

const PRIZES: CompetitionPrize[] = [
  { name: "一等奖", subjectExp: 30, insightExp: 10, charmExp: 5 },
  { name: "二等奖", subjectExp: 20, insightExp: 7, charmExp: 3 },
  { name: "三等奖", subjectExp: 12, insightExp: 5, charmExp: 2 },
  { name: "未获奖", subjectExp: 5, insightExp: 0, charmExp: 0 },
];

export const COMPETITION_POOL: CompetitionEvent[] = [
  { id: "comp_math", subject: "math", subjectName: "数学竞赛", minLevel: 1, prizes: PRIZES },
  { id: "comp_chinese", subject: "chinese", subjectName: "语文竞赛", minLevel: 1, prizes: PRIZES },
  { id: "comp_english", subject: "english", subjectName: "英语竞赛", minLevel: 1, prizes: PRIZES },
  { id: "comp_pe", subject: "pe", subjectName: "体育运动会", minLevel: 1, prizes: PRIZES },
  { id: "comp_history", subject: "history", subjectName: "历史知识竞赛", minLevel: 1, prizes: PRIZES },
  { id: "comp_physics", subject: "physics", subjectName: "物理实验竞赛", minLevel: 1, prizes: PRIZES },
  { id: "comp_chemistry", subject: "chemistry", subjectName: "化学实验竞赛", minLevel: 1, prizes: PRIZES },
];

/**
 * 按年龄解锁 + 学科等级筛选可参加的竞赛。
 * 年龄未到该学科解锁年龄，或学科等级 < minLevel 的竞赛不返回。
 */
export function pickCompetitions(age: number, subjectExp: SubjectExpMap): CompetitionEvent[] {
  return COMPETITION_POOL.filter((e) => {
    const unlockAge = SUBJECT_UNLOCK_AGE[e.subject];
    if (unlockAge === undefined || age < unlockAge) return false;
    return (subjectExp[e.subject]?.level ?? 0) >= e.minLevel;
  });
}

/**
 * 按学科等级定名次：
 * - Lv1-2：未获奖
 * - Lv3-4：三等奖/二等奖机会（50/50）
 * - Lv5+：一等奖机会（50% 一 / 30% 二 / 20% 三）
 */
export function resolveCompetition(
  event: CompetitionEvent,
  subjectLevel: number
): CompetitionPrize {
  if (subjectLevel <= 2) return event.prizes[3]!; // 未获奖
  if (subjectLevel <= 4) return event.prizes[2]!; // 三等奖
  if (subjectLevel <= 6) {
    return Math.random() < 0.5 ? event.prizes[1]! : event.prizes[2]!; // 50%二/50%三
  }
  if (subjectLevel <= 8) {
    const r = Math.random();
    if (r < 0.5) return event.prizes[0]!; // 50%一
    if (r < 0.8) return event.prizes[1]!; // 30%二
    return event.prizes[2]!; // 20%三
  }
  // Lv9+
  return Math.random() < 0.8 ? event.prizes[0]! : event.prizes[1]!; // 80%一/20%二
}

// 学科经验累加，等级曲线同属性：100×level^1.5
function subjectLevelFromExp(exp: number): number {
  if (exp <= 0) return 0;
  let lv = 0;
  while (exp >= Math.ceil(100 * Math.pow(lv + 1, 1.5))) lv++;
  return lv;
}

export function addSubjectExp(current: SubjectExpMap, delta: Record<string, number>): SubjectExpMap {
  const next: SubjectExpMap = { ...current };
  for (const [key, value] of Object.entries(delta)) {
    const cur = next[key] || { exp: 0, level: 0 };
    const exp = cur.exp + value;
    next[key] = { exp, level: subjectLevelFromExp(exp) };
  }
  return next;
}

/** 返回某年龄已解锁的学科 key 列表 */
export function unlockedSubjects(age: number): string[] {
  return Object.entries(SUBJECT_UNLOCK_AGE)
    .filter(([, unlockAge]) => age >= unlockAge)
    .map(([key]) => key);
}
