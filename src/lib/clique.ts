// 派系（clique）逻辑 —— 被 lib/__tests__/clique.test.ts 依赖。
// 重建依据：测试导入契约（decideClique / getCliqueBonus / getCliqueInfo / CLIQUE_INFO）。

export type CliqueKey = "nerd" | "sport" | "delinquent" | "normal";

export interface CliqueInfo {
  key: CliqueKey;
  name: string;
  desc: string;
}

export interface CliqueAttrs {
  insight: number;
  root: number;
}

export const CLIQUE_INFO: Record<CliqueKey, CliqueInfo> = {
  nerd: { key: "nerd", name: "学霸圈", desc: "聪慧好学，悟性渐长。" },
  sport: { key: "sport", name: "体育圈", desc: "强健体魄，根骨扎实。" },
  delinquent: { key: "delinquent", name: "混混圈", desc: "街头厮混，魅力见长却心性不稳。" },
  normal: { key: "normal", name: "普通圈", desc: "平平淡淡，心境安稳。" },
};

/** 6 岁前与 16 岁后不分配圈子；依突出属性映射到圈子。 */
export function decideClique(attrs: CliqueAttrs, age: number): CliqueKey | null {
  if (age < 6 || age >= 16) return null;
  const { insight, root } = attrs;
  if (insight >= 60 && insight > root + 10) return "nerd";
  if (root >= 60 && root > insight + 10) return "sport";
  if (insight < 30 && root < 30) return "delinquent";
  return "normal";
}

/** 年度属性加成数值。无圈子返回空对象。 */
export function getCliqueBonus(key: CliqueKey | null | undefined): Record<string, number> {
  switch (key) {
    case "nerd":
      return { insight: 0.3 };
    case "sport":
      return { root: 0.3 };
    case "delinquent":
      return { charm: 0.2, mind: -0.1 };
    case "normal":
      return { mind: 0.1 };
    default:
      return {};
  }
}

export function getCliqueInfo(key: CliqueKey | null | undefined): CliqueInfo | null {
  if (!key) return null;
  return CLIQUE_INFO[key] ?? null;
}
