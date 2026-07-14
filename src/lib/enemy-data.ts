// ============================================================
// 敌人数据
// ============================================================

export interface Enemy {
  id: string;
  name: string;
  realm: string;
  combatPower: number;
  rarity: "普通" | "精英" | "BOSS";
  locationIds: string[];
}

export const ENEMIES: Enemy[] = [
  { id: "wild_dog", name: "野狗", realm: "凡人", combatPower: 20, rarity: "普通", locationIds: ["wild"] },
  { id: "venom_snake", name: "毒蛇", realm: "凡人", combatPower: 35, rarity: "普通", locationIds: ["wild"] },
  { id: "bandit", name: "山贼", realm: "炼气期", combatPower: 80, rarity: "普通", locationIds: ["downtown", "wild"] },
  { id: "beast_cub", name: "妖兽幼崽", realm: "炼气期", combatPower: 120, rarity: "普通", locationIds: ["wild"] },
  { id: "dark_cultivator", name: "邪修", realm: "筑基期", combatPower: 300, rarity: "精英", locationIds: ["downtown", "wild"] },
  { id: "beast_adult", name: "妖兽成体", realm: "筑基期", combatPower: 400, rarity: "精英", locationIds: ["wild"] },
  { id: "beast_king", name: "妖兽王", realm: "结丹期", combatPower: 1500, rarity: "BOSS", locationIds: ["wild"] },
  { id: "ancient_spirit", name: "古修士残魂", realm: "元婴期", combatPower: 5000, rarity: "BOSS", locationIds: ["cave"] },
  { id: "fiend", name: "魔头", realm: "化神期", combatPower: 15000, rarity: "BOSS", locationIds: ["wild", "cave"] },
  { id: "void_beast", name: "虚空兽", realm: "炼虚期", combatPower: 50000, rarity: "BOSS", locationIds: ["wild"] },
  { id: "celestial", name: "天界使者", realm: "合体期", combatPower: 150000, rarity: "BOSS", locationIds: ["cave"] },
  { id: "dao_guardian", name: "道界守护者", realm: "大乘期", combatPower: 500000, rarity: "BOSS", locationIds: ["cave"] },
  { id: "immortal", name: "真仙投影", realm: "渡劫期", combatPower: 1000000, rarity: "BOSS", locationIds: ["cave"] },
];

const SAFE_LOCATIONS = ["home", "kindergarten", "school"];

/**
 * 获取某地点的敌人（安全地点返回空数组）。
 * 过滤规则：只返回与玩家境界差 ≤ 1 的敌人。
 */
export function getEnemiesForLocation(locationId: string, playerRealm: string): Enemy[] {
  if (SAFE_LOCATIONS.includes(locationId)) return [];
  const pool = ENEMIES.filter((e) => e.locationIds.includes(locationId));
  return pool.filter((e) => Math.abs(getRealmIndex(e.realm) - getRealmIndex(playerRealm)) <= 1);
}

const REALM_ORDER = ["凡人", "炼气期", "筑基期", "结丹期", "元婴期", "化神期", "炼虚期", "合体期", "大乘期", "渡劫期"];

/** 获取境界索引 */
export function getRealmIndex(realm: string): number {
  const idx = REALM_ORDER.indexOf(realm);
  return idx >= 0 ? idx : 0;
}

/** 境界系数：1.5 ^ 境界索引 */
export function getRealmMultiplier(realm: string): number {
  return Math.pow(1.5, getRealmIndex(realm));
}

/** 随机选取一个敌人 */
export function pickEnemy(enemies: Enemy[]): Enemy | null {
  if (enemies.length === 0) return null;
  return enemies[Math.floor(Math.random() * enemies.length)];
}