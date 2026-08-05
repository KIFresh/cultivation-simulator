import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ISOLATION_EVENTS,
  pickIsolationEvent,
  checkIsolationTrigger,
  parseIsolationState,
  isIsolated,
  releaseIsolation,
} from "../social-events";
import {
  calculateSchoolRankFromSubjects,
  SCHOOL_RANK_THRESHOLDS,
  SCHOOL_RANKS,
} from "../cultivation-data";
import {
  askTeacherQuestion,
  rewardTeachersForAchievement,
  TEACHER_TYPE,
} from "../teacher";
import type { NpcRelationData } from "../classmate-data";

afterEach(() => {
  vi.restoreAllMocks();
});

function subjectLevels(levels: Record<string, number>) {
  const out: Record<string, { exp: number; level: number }> = {};
  for (const [k, lv] of Object.entries(levels)) out[k] = { exp: lv * 100, level: lv };
  return out;
}

function teacherRel(intimacy: number): Record<string, NpcRelationData> {
  return { 王老师: { intimacy, avatar: "🧑‍🏫", realm: "凡人", metAt: 6, category: "师长", type: TEACHER_TYPE } };
}

// ── 孤立判定 ─────────────────────────────────────────────

describe("checkIsolationTrigger", () => {
  it("12 岁前（小学）不触发", () => {
    expect(checkIsolationTrigger(1, 11, undefined)).toBe(false);
  });
  it("魅力 Lv0（无经验）不触发", () => {
    expect(checkIsolationTrigger(0, 12, undefined)).toBe(false);
  });
  it("魅力 Lv3+ 免疫（不触发）", () => {
    expect(checkIsolationTrigger(3, 12, undefined)).toBe(false);
  });
  it("魅力 Lv1-2 且无冷却时按 10-20% 概率触发（random=0 → 触发）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(checkIsolationTrigger(1, 12, undefined)).toBe(true);
  });
  it("random=1 → 不触发", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    expect(checkIsolationTrigger(2, 12, undefined)).toBe(false);
  });
  it("孤立中或解除后 1 年冷却期内不触发（isolatedUntil=13, age=12/13 均被拦）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(checkIsolationTrigger(1, 12, 13)).toBe(false);
    expect(checkIsolationTrigger(1, 13, 13)).toBe(false);
  });
  it("冷却期过后可再次触发（isolatedUntil=13, age=14）", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(checkIsolationTrigger(1, 14, 13)).toBe(true);
  });
});

describe("pickIsolationEvent / 状态工具", () => {
  it("随机事件来自 ISOLATION_EVENTS 池", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickIsolationEvent()).toBe(ISOLATION_EVENTS[0]);
    expect(ISOLATION_EVENTS.length).toBeGreaterThanOrEqual(4);
  });
  it("parseIsolationState 容错（null/非法 JSON/非对象）", () => {
    expect(parseIsolationState(null)).toEqual({});
    expect(parseIsolationState("not-json")).toEqual({});
    expect(parseIsolationState('"str"')).toEqual({});
    expect(parseIsolationState('{"isolatedUntil":13}')).toEqual({ isolatedUntil: 13 });
  });
  it("isIsolated：isolatedUntil > 当前年龄 才视为孤立中", () => {
    expect(isIsolated({ isolatedUntil: 13 }, 12)).toBe(true);
    expect(isIsolated({ isolatedUntil: 13 }, 13)).toBe(false);
    expect(isIsolated({}, 12)).toBe(false);
  });
  it("releaseIsolation：立即解除（冷却从解除当年起算）", () => {
    expect(releaseIsolation({ isolatedUntil: 13 }, 12)).toEqual({ isolatedUntil: 12 });
  });
});

// ── 升学判定 ─────────────────────────────────────────────

describe("calculateSchoolRankFromSubjects", () => {
  it("空 subjectExp → 普通", () => {
    expect(calculateSchoolRankFromSubjects({}, 0)).toBe("普通");
  });
  it("学科加权：主科×3 副科×1（全 Lv5 六门 → 平均 5.0）", () => {
    const subj = subjectLevels({ math: 5, chinese: 5, english: 5, pe: 5, history: 5, physics: 5 });
    expect(calculateSchoolRankFromSubjects(subj, 0, SCHOOL_RANK_THRESHOLDS[12])).toBe("重点");
  });
  it("12 岁全 Lv6 → 名校（≥6.0）", () => {
    const subj = subjectLevels({ math: 6, chinese: 6, english: 6, pe: 6, history: 6, physics: 6 });
    expect(calculateSchoolRankFromSubjects(subj, 0, SCHOOL_RANK_THRESHOLDS[12])).toBe("名校");
  });
  it("12 岁加权 5.75：无修正 → 重点；师长好感 +0.5 → 名校", () => {
    const subj = subjectLevels({ math: 7, chinese: 6, english: 5, pe: 5, history: 5, physics: 5 });
    expect(calculateSchoolRankFromSubjects(subj, 0, SCHOOL_RANK_THRESHOLDS[12])).toBe("重点");
    expect(calculateSchoolRankFromSubjects(subj, 0.5, SCHOOL_RANK_THRESHOLDS[12])).toBe("名校");
  });
  it("15 岁全 Lv5 → 重点（≥4.5 且 <6.5）；18 岁全 Lv4 → 普通（<5.0）", () => {
    const lv5 = subjectLevels({ math: 5, chinese: 5, english: 5, pe: 5, history: 5, physics: 5, chemistry: 5 });
    expect(calculateSchoolRankFromSubjects(lv5, 0, SCHOOL_RANK_THRESHOLDS[15])).toBe("重点");
    const lv4 = subjectLevels({ math: 4, chinese: 4, english: 4, pe: 4, history: 4, physics: 4, chemistry: 4 });
    expect(calculateSchoolRankFromSubjects(lv4, 0, SCHOOL_RANK_THRESHOLDS[18])).toBe("普通");
  });
  it("未解锁/未知学科键不计入", () => {
    const subj = subjectLevels({ math: 5, foo: 10 });
    expect(calculateSchoolRankFromSubjects(subj, 0, SCHOOL_RANK_THRESHOLDS[12])).toBe("重点"); // 平均仍 5.0
  });
  it("SCHOOL_RANKS attrMultiplier：普通 1.0 / 重点 1.25 / 名校 1.5", () => {
    expect(SCHOOL_RANKS["普通"].attrMultiplier).toBe(1.0);
    expect(SCHOOL_RANKS["重点"].attrMultiplier).toBe(1.25);
    expect(SCHOOL_RANKS["名校"].attrMultiplier).toBe(1.5);
  });
});

// ── 师长好感增长 ─────────────────────────────────────────

describe("askTeacherQuestion / rewardTeachersForAchievement", () => {
  it("请教问题：随机一位师长 +2，其他关系不动", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const rels: Record<string, NpcRelationData> = {
      王老师: { intimacy: 0, avatar: "🧑‍🏫", realm: "凡人", metAt: 6, category: "师长", type: TEACHER_TYPE },
      李老师: { intimacy: 5, avatar: "🧑‍🏫", realm: "凡人", metAt: 6, category: "师长", type: TEACHER_TYPE },
      小明: { intimacy: 99, avatar: "🧒", realm: "凡人", metAt: 6, category: "同学", type: "classmate" },
    };
    const out = askTeacherQuestion(rels);
    expect(out["王老师"].intimacy).toBe(2);
    expect(out["李老师"].intimacy).toBe(5);
    expect(out["小明"].intimacy).toBe(99);
  });
  it("无师长时原样返回", () => {
    const rels = { 小明: { intimacy: 1, avatar: "🧒", realm: "凡人", metAt: 6, category: "同学", type: "classmate" as string } };
    expect(askTeacherQuestion(rels)).toBe(rels);
    expect(rewardTeachersForAchievement(rels)).toBe(rels);
  });
  it("成绩联动：拿奖 → 全体任课老师 +10", () => {
    const out = rewardTeachersForAchievement({
      王老师: { intimacy: 60, avatar: "🧑‍🏫", realm: "凡人", metAt: 6, category: "师长", type: TEACHER_TYPE },
      李老师: { intimacy: 0, avatar: "🧑‍🏫", realm: "凡人", metAt: 6, category: "师长", type: TEACHER_TYPE },
    });
    expect(Object.values(out).every((r) => r.intimacy === 70 || r.intimacy === 10)).toBe(true);
  });
  it("getTeacherRankBonus 阈值兼容：70 好感即可加权（配合 route 的 ×0.5 修正）", async () => {
    const { getTeacherRankBonus } = await import("../teacher");
    expect(getTeacherRankBonus(teacherRel(70))).toBe(1);
    expect(getTeacherRankBonus(teacherRel(69))).toBe(0);
  });
});
