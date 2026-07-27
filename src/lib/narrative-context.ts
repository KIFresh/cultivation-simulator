/**
 * 叙事状态快照 — AI 视角看到的只读游戏状态。
 * 所有叙事路由必须从此模块构建状态，禁止客户端提交权威字段。
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

export interface FamilyMemberSnapshot {
  relation: string;
  name: string;
  age: number;
  alive: boolean;
  occupation?: string | null;
  livingTogether?: boolean;
}

export interface NarrativeStateSnapshot {
  cultivatorId: string;
  userId: string;
  name: string;
  age: number;
  quarter: number;
  realm: string;
  realmLevel: number;
  location: string;       // 中文地点名
  locationId: string;      // 原始 location ID
  stamina: number;
  maxStamina: number;
  gold: number;
  health: number;
  maxAge: number;
  toxicity: number;
  attributes: Record<string, number>;
  occupation?: string | null;
  schoolRank: number;
  family: FamilyMemberSnapshot[];
  storySummary?: string | null;
}

// ============================================================
// 构建函数
// ============================================================

/** 从 Prisma Cultivator 记录构建只读状态快照 */
export async function buildNarrativeSnapshot(cultivator: {
  id: string;
  userId: string;
  name: string;
  age: number;
  quarter?: number | null;
  realm: string;
  realmLevel?: number | null;
  location: string;
  stamina?: number | null;
  maxStamina?: number | null;
  gold?: number | null;
  health?: number | null;
  maxAge?: number | null;
  toxicity?: number | null;
  attributes?: unknown;
  occupation?: string | null;
  schoolRank?: number | null;
  storySummary?: string | null;
}): Promise<NarrativeStateSnapshot> {
  // 解析属性
  const attrs =
    typeof cultivator.attributes === "object" && cultivator.attributes
      ? (cultivator.attributes as Record<string, number>)
      : {};
  
  // 解析地点中文名
  let locationName = "未知之地";
  try {
    const { LOCATIONS } = await import("@/lib/cultivation-data");
    const loc = LOCATIONS.find((l: { id: string; name: string }) => l.id === cultivator.location);
    if (loc) locationName = loc.name;
  } catch {
    locationName = cultivator.location || "未知之地";
  }

  // 加载家庭成员
  let family: FamilyMemberSnapshot[] = [];
  try {
    const members = await prisma.familyMember.findMany({
      where: { cultivatorId: cultivator.id },
      select: { relation: true, name: true, age: true, alive: true, occupation: true },
    });
    family = members.map((m) => ({
      relation: m.relation,
      name: m.name,
      age: m.age,
      alive: m.alive,
      occupation: m.occupation,
      livingTogether: true, // 默认同住
    }));
  } catch {
    // 家庭加载失败不阻塞叙事
  }

  return {
    cultivatorId: cultivator.id,
    userId: cultivator.userId,
    name: cultivator.name,
    age: cultivator.age,
    quarter: cultivator.quarter ?? 1,
    realm: cultivator.realm,
    realmLevel: cultivator.realmLevel ?? 0,
    location: locationName,
    locationId: cultivator.location,
    stamina: cultivator.stamina ?? 100,
    maxStamina: cultivator.maxStamina ?? 100,
    gold: cultivator.gold ?? 0,
    health: cultivator.health ?? 100,
    maxAge: cultivator.maxAge ?? 100,
    toxicity: cultivator.toxicity ?? 0,
    attributes: attrs,
    occupation: cultivator.occupation,
    schoolRank: cultivator.schoolRank ?? 0,
    family,
    storySummary: cultivator.storySummary,
  };
}

// ============================================================
// Prompt 格式化
// ============================================================

/** 将快照格式化为 AI 可读的上下文字符串 */
export function formatSnapshotForPrompt(s: NarrativeStateSnapshot): string {
  const lines: string[] = [
    `## 当前状态`,
    `姓名：${s.name}`,
    `年龄：${s.age}岁  |  季度：第${s.quarter}季`,
    `境界：${s.realm} ${formatRealmLevelText(s.realm, s.realmLevel)}`,
    `地点：${s.location}`,
    `体力：${s.stamina}/${s.maxStamina}`,
    `寿元：${s.health}/${s.maxAge}  |  金币：${s.gold}`,
    `丹毒：${s.toxicity}`,
  ];

  // 属性
  const attrLabels: Record<string, string> = {
    root: "根骨", bone: "根骨", spirit: "灵性", insight: "悟性",
    comprehension: "悟性", luck: "气运", fortune: "气运", charm: "魅力", mind: "心性",
  };
  const attrStr = Object.entries(s.attributes)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => `${attrLabels[k] || k} ${v}`)
    .join("，");
  if (attrStr) lines.push(`资质：${attrStr}`);

  // 职业/学校
  if (s.occupation) lines.push(`职业：${s.occupation}`);
  if (s.schoolRank !== undefined && s.schoolRank !== null) {
    const rankName = ["普通", "重点", "名校"][s.schoolRank] || "普通";
    lines.push(`学校：${rankName}`);
  }

  // 家庭成员
  if (s.family.length > 0) {
    const familyStr = s.family
      .filter((m) => m.alive)
      .map((m) => {
        let desc = `${m.relation} ${m.name}`;
        if (m.occupation) desc += `（${m.occupation}）`;
        return desc;
      })
      .join("、");
    lines.push(`家人：${familyStr}`);
  }

  // 剧情概要
  if (s.storySummary) {
    lines.push(`\n近期经历：${s.storySummary}`);
  }

  // 地点约束说明
  lines.push(
    `\n【约束】当前所在地点是"${s.location}"，所有事件、环境和活动必须严格发生在此地，不得无故切换。`
  );

  return lines.join("\n");
}

/** 境界层级文字化 */
function formatRealmLevelText(realm: string, level: number): string {
  if (!level || realm === "凡人") return "";
  const tiers = ["初期", "中期", "后期", "巅峰", "大圆满"];
  if (level <= tiers.length) return `（${tiers[level - 1]}）`;
  return `（${level}层）`;
}

// ============================================================
// 快捷入口 — 单次调用同时完成构建与格式化
// ============================================================

/** 从数据库修炼者记录构建并返回格式化 Prompt 字符串 */
export async function buildFormattedState(cultivator: Parameters<typeof buildNarrativeSnapshot>[0]): Promise<string> {
  const snapshot = await buildNarrativeSnapshot(cultivator);
  return formatSnapshotForPrompt(snapshot);
}
