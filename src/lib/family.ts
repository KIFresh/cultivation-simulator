// 地球世界：生成初始家庭（父母 + 视身份而定的成员）。
// 被 src/app/create/page.tsx 与 src/app/dev/page.tsx 使用，结果以 JSON 存 localStorage。

import type { FamilyMember } from "@/app/dashboard/types";

export interface EarthFamily {
  members: FamilyMember[];
}

const SURNAMES = ["林", "陈", "赵", "周", "吴", "郑", "王", "李"];
const GIVEN = ["建国", "秀英", "志强", "丽华", "文", "静", "磊", "婷", "海", "梅"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * 生成地球家庭。
 * @param seed 任意数字，用于稳定生成（同一 seed 同结果）。
 * @param identityId 出身身份，影响父母亲密度与额外成员。
 */
export function generateEarthFamily(seed: number = 1, identityId: string = "scholar"): EarthFamily {
  const fatherName = `${pick(SURNAMES, seed + 1)}${pick(GIVEN, seed + 3)}`;
  const motherName = `${pick(SURNAMES, seed + 7)}${pick(GIVEN, seed + 9)}`;

  const baseIntimacy = identityIntimacy(identityId);
  const members: FamilyMember[] = [
    {
      id: `f_${seed}_father`,
      name: fatherName,
      relation: "父亲",
      alive: true,
      age: 38 + (Math.abs(seed) % 12),
      intimacy: clampIntimacy(baseIntimacy + 5),
    },
    {
      id: `f_${seed}_mother`,
      name: motherName,
      relation: "母亲",
      alive: true,
      age: 36 + (Math.abs(seed) % 12),
      intimacy: clampIntimacy(baseIntimacy + 5),
    },
  ];

  // 商贾/书香之家更可能有祖辈同住
  if (identityId === "merchant" || identityId === "scholar") {
    members.push({
      id: `f_${seed}_grandpa`,
      name: `${pick(SURNAMES, seed + 11)}老爷`,
      relation: "祖父",
      alive: true,
      age: 60 + (Math.abs(seed) % 20),
      intimacy: clampIntimacy(baseIntimacy - 5),
    });
  }

  // 书香/将门可能有个兄弟姐妹
  if (identityId === "scholar" || identityId === "general" || identityId === "sect") {
    members.push({
      id: `f_${seed}_sibling`,
      name: `${pick(SURNAMES, seed + 5)}弟`,
      relation: "弟弟",
      alive: true,
      age: 1 + (Math.abs(seed) % 8),
      intimacy: clampIntimacy(baseIntimacy),
    });
  }

  return { members };
}

function identityIntimacy(identityId: string): number {
  switch (identityId) {
    case "orphan":
      return 20;
    case "merchant":
      return 70;
    case "scholar":
      return 75;
    case "general":
      return 60;
    case "sect":
      return 65;
    default:
      return 55;
  }
}

function clampIntimacy(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** 解析已存储的家庭 JSON（容错）。 */
export function parseFamily(raw: string | null): EarthFamily {
  if (!raw) return { members: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { members?: unknown }).members)) {
      return parsed as EarthFamily;
    }
  } catch {
    // ignore
  }
  return { members: [] };
}
