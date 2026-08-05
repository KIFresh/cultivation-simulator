"use client";

import { useCallback, useMemo } from "react";
import { useGameStore } from "@/store";
import { safeJsonParse } from "@/lib/json-helper";
import { isAwakened } from "@/lib/cultivation-data";

export interface SkillLevel {
  id: string;
  name: string;
  level: number;
  exp: number;
  expToNext: number;
}

const ATTR_LABELS: Record<string, string> = {
  root: "根骨",
  spirit: "感知",
  insight: "悟性",
  luck: "气运",
  charm: "魅力",
  mind: "心性",
};

const SUBJECT_LABELS: Record<string, string> = {
  sword: "剑道",
  talisman: "符箓",
  pill: "丹道",
  array: "阵法",
  beast: "御兽",
  math: "数学",
  chinese: "语文",
  english: "英语",
  pe: "体育",
  history: "历史",
  physics: "物理",
  chemistry: "化学",
};

const EXP_PER_LEVEL = 100;

type ExpRecord = Record<string, { exp: number; level: number }>;

function toRecord(raw: unknown): ExpRecord {
  if (!raw) return {};
  if (typeof raw === "string") {
    return safeJsonParse<ExpRecord>(raw, {});
  }
  if (typeof raw === "object") {
    return raw as ExpRecord;
  }
  return {};
}

/**
 * 将 attributeExp / subjectExp 实时派生为「技能等级」。
 * 项目记忆：技能等级实时同步 —— 等级由经验值即时计算，无需额外存储。
 * isAwake 控制双阶段命名：凡人期 spirit 显示「感知」，觉醒后显示「灵性」。
 */
export function deriveSkillLevels(attributeExp: unknown, subjectExp: unknown, isAwake = false): SkillLevel[] {
  const attr = toRecord(attributeExp);
  const subj = toRecord(subjectExp);
  const skills: SkillLevel[] = [];

  for (const [key, val] of Object.entries(attr)) {
    const exp = Math.max(0, Math.floor(val?.exp ?? 0));
    const level = val?.level ?? Math.floor(exp / EXP_PER_LEVEL) + 1;
    const name = key === "spirit" ? (isAwake ? "灵性" : "感知") : ATTR_LABELS[key] ?? key;
    skills.push({
      id: `attr_${key}`,
      name: key === "spirit" ? (isAwake ? "灵性" : "感知") : ATTR_LABELS[key] ?? key,
      level,
      exp: exp % EXP_PER_LEVEL,
      expToNext: EXP_PER_LEVEL,
    });
  }

  for (const [key, val] of Object.entries(subj)) {
    const exp = Math.max(0, Math.floor(val?.exp ?? 0));
    const level = val?.level ?? Math.floor(exp / EXP_PER_LEVEL) + 1;
    skills.push({
      id: `subj_${key}`,
      name: SUBJECT_LABELS[key] ?? key,
      level,
      exp: exp % EXP_PER_LEVEL,
      expToNext: EXP_PER_LEVEL,
    });
  }

  return skills.sort((a, b) => b.level - a.level);
}

export interface UseDataSyncResult {
  skills: SkillLevel[];
  /** 触发一次同步（技能等级实时派生，此处仅作接口对称，可安全调用） */
  sync: () => void;
}

/**
 * 订阅 store 中的修炼者数据，实时把 attributeExp / subjectExp 同步为技能等级。
 */
export function useDataSync(): UseDataSyncResult {
  const cultivator = useGameStore((s) => s.cultivator);
  const isAwake = cultivator ? isAwakened(cultivator.realm) : false;

  const skills = useMemo(
    () => deriveSkillLevels(cultivator?.attributeExp ?? null, cultivator?.subjectExp ?? null, isAwake),
    [cultivator?.attributeExp, cultivator?.subjectExp, isAwake]
  );

  const sync = useCallback(() => {
    // 技能等级由 attributeExp / subjectExp 实时派生，已通过 useMemo 自动同步，
    // 此处保留为显式触发入口，便于未来接入落库。
  }, []);

  return { skills, sync };
}
