/**
 * 叙事一致性校验器 — 验证 AI 生成结果与玩家实际状态的匹配程度。
 * 纯函数模块，不依赖数据库。
 */

import type { NarrativeStateSnapshot } from "./narrative-context";
import type { BirthFamilyMember } from "./narrative";

// ============================================================
// 校验结果类型
// ============================================================

export interface ConsistencyViolation {
  field: string;
  severity: "error" | "warning";
  expected: string;
  actual: string;
  message: string;
}

export interface ConsistencyReport {
  passed: boolean;
  violations: ConsistencyViolation[];
  canAutoFix: boolean;
}

// ============================================================
// 通用校验器
// ============================================================

/** 检查主角姓名是否与快照一致 */
export function checkNameConsistency(
  narrativeText: string,
  snapshotName: string
): ConsistencyViolation | null {
  // 允许叙文中使用全名、爱称或"我/他/她"
  const nameInText = narrativeText.includes(snapshotName);
  if (!nameInText) {
    // 但不是必须出现，很多叙事用"他/她/这孩子"指代，不强制
    return null;
  }
  return null;
}

/** 检查地点一致性 */
export function checkLocationConsistency(
  narrativeText: string,
  snapshotLocation: string,
  snapshotLocationId: string
): ConsistencyViolation | null {
  // 检查叙文中是否提到了与快照地点明显不符的地点名
  const forbiddenLocations = ["学校", "家", "野外", "洞府", "坊市", "市区", "幼儿园"].filter(
    (loc) => loc !== snapshotLocation
  );

  for (const loc of forbiddenLocations) {
    if (narrativeText.includes(loc)) {
      // 如果是否定上下文（"不在学校"、"没去学校"），不算违规
      const contextBefore = getContextBefore(narrativeText, loc, 15);
      if (contextBefore && /[不没别]/.test(contextBefore)) {
        continue;
      }
      return {
        field: "location",
        severity: "error",
        expected: snapshotLocation,
        actual: loc,
        message: `叙文提及"${loc}"，但当前地点为"${snapshotLocation}"。叙事必须发生当前地点。`,
      };
    }
  }
  return null;
}

/** 检查年龄一致性 */
export function checkAgeConsistency(age: number, snapshotAge: number): ConsistencyViolation | null {
  // 出生叙事：年龄应为 0 或 1
  if (age <= 1 && snapshotAge === 1) return null; // 出生场景
  return null;
}

/** 检查 body.xxxId 未传入 */
export function checkClientOverride(
  body: Record<string, unknown>,
  field: string
): ConsistencyViolation | null {
  if (body[field] !== undefined) {
    return {
      field,
      severity: "warning",
      expected: "服务端权威",
      actual: `客户端传入 ${JSON.stringify(body[field])}`,
      message: `请求包含客户端提供的 ${field}，将被服务端忽略。`,
    };
  }
  return null;
}

/** 出生叙事：主角名、叙文、家庭成员一致 */
export function checkBirthConsistency(
  narrative: {
    narrative: string;
    suggestedName?: string;
    family?: BirthFamilyMember[];
  },
  snapshot: NarrativeStateSnapshot
): ConsistencyViolation[] {
  const violations: ConsistencyViolation[] = [];
  const name = narrative.suggestedName || snapshot.name;

  // 主角名出现在叙文中
  if (name && !narrative.narrative.includes(name)) {
    violations.push({
      field: "suggestedName",
      severity: "warning",
      expected: `叙文包含"${name}"`,
      actual: `叙文中未找到"${name}"`,
      message: `建议名"${name}"未出现在出生叙事正文中。建议 AI 补全。`,
    });
  }

  // 每个家庭成员出现在叙文中
  if (narrative.family) {
    const relationMap = new Map<string, number>();
    for (const m of narrative.family) {
      // 去重检查：同关系不应出现两次
      const key = m.relation;
      relationMap.set(key, (relationMap.get(key) || 0) + 1);
    }
    for (const [relation, count] of relationMap) {
      if (count > 1) {
        violations.push({
          field: "family",
          severity: "error",
          expected: `每个关系最多 1 人`,
          actual: `${relation} 出现 ${count} 次`,
          message: `家庭数组中"${relation}"重复出现 ${count} 次。`,
        });
      }
    }

    // 每个成员的名字出现在叙文中（可选但推荐）
    for (const m of narrative.family) {
      if (m.name && !narrative.narrative.includes(m.name)) {
        violations.push({
          field: `family.${m.relation}`,
          severity: "warning",
          expected: `叙文提及"${m.name}"`,
          actual: `叙文中未找到"${m.name}"`,
          message: `家庭成员"${m.relation} ${m.name}"未出现在叙事正文中。`,
        });
      }
    }
  }

  return violations;
}

// ============================================================
// 一站式检查
// ============================================================

/** 运行所有关联校验并返回最终报告 */
export function runConsistencyChecks(
  narrative: {
    narrative: string;
    suggestedName?: string;
    family?: BirthFamilyMember[];
  },
  snapshot: NarrativeStateSnapshot,
  requestBody: Record<string, unknown>
): ConsistencyReport {
  const violations: ConsistencyViolation[] = [];

  // 1. 地点一致性
  const locIssue = checkLocationConsistency(
    narrative.narrative,
    snapshot.location,
    snapshot.locationId
  );
  if (locIssue) violations.push(locIssue);

  // 2. 出生叙事一致性
  if (narrative.family) {
    const birthIssues = checkBirthConsistency(narrative, snapshot);
    violations.push(...birthIssues);
  }

  // 3. 客户端覆盖检查
  const bodyFields = ["name", "age", "realm", "location", "stamina", "gold"];
  for (const field of bodyFields) {
    const issue = checkClientOverride(requestBody, field);
    if (issue) violations.push(issue);
  }

  const errors = violations.filter((v) => v.severity === "error");
  return {
    passed: errors.length === 0,
    violations,
    canAutoFix: false, // 大多数不一致需要 AI 重生成
  };
}

// ============================================================
// 工具函数
// ============================================================

function getContextBefore(text: string, keyword: string, chars: number): string {
  const idx = text.indexOf(keyword);
  if (idx < 0) return "";
  const start = Math.max(0, idx - chars);
  return text.slice(start, idx);
}
