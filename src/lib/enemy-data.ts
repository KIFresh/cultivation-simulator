// ============================================================
// 敌人数据
// ============================================================
// 本地定义境界序列（与 cultivation-data 保持一致，避免依赖未导出符号）
const REALM_ORDER = [
  "凡人",
  "炼气期",
  "筑基期",
  "结丹期",
  "元婴期",
  "化神期",
  "炼虚期",
  "合体期",
  "大乘期",
  "渡劫期",
];

export interface Enemy {
  id: string;
  name: string;
  realm: string;
  combatPower: number;
  rarity: "普通" | "精英" | "BOSS";
  locationIds: string[];
  /** 掉落池，从该数组中随机选取 */
  drops?: string[];
}

export const ENEMIES: Enemy[] = [
  {
    id: "wild_dog",
    name: "野狗",
    realm: "凡人",
    combatPower: 20,
    rarity: "普通",
    locationIds: ["wild"],
    drops: ["spirit_stone", "bone"],
  },
  {
    id: "venom_snake",
    name: "毒蛇",
    realm: "凡人",
    combatPower: 35,
    rarity: "普通",
    locationIds: ["wild"],
    drops: ["spirit_stone", "venom_sac"],
  },
  {
    id: "bandit",
    name: "山贼",
    realm: "炼气期",
    combatPower: 80,
    rarity: "普通",
    locationIds: ["downtown", "wild"],
    drops: ["spirit_stone", "spirit_stone", "copper_coin"],
  },
  {
    id: "beast_cub",
    name: "妖兽幼崽",
    realm: "炼气期",
    combatPower: 120,
    rarity: "普通",
    locationIds: ["wild"],
    drops: ["spirit_stone", "beast_skin"],
  },
  {
    id: "dark_cultivator",
    name: "邪修",
    realm: "筑基期",
    combatPower: 300,
    rarity: "精英",
    locationIds: ["downtown", "wild"],
    drops: ["spirit_stone", "spirit_stone", "dark_talisman"],
  },
  {
    id: "beast_adult",
    name: "妖兽成体",
    realm: "筑基期",
    combatPower: 400,
    rarity: "精英",
    locationIds: ["wild"],
    drops: ["spirit_stone", "spirit_stone", "beast_essence"],
  },
  {
    id: "beast_king",
    name: "妖兽王",
    realm: "结丹期",
    combatPower: 1500,
    rarity: "BOSS",
    locationIds: ["wild"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "beast_core", "royal_fur"],
  },
  // 妖将：镇守野外的妖兽部族将领，统领低阶妖兽，持骨矛列阵。
  {
    id: "demon_general",
    name: "妖将",
    realm: "元婴期",
    combatPower: 5000,
    rarity: "精英",
    locationIds: ["wild"],
    drops: ["spirit_stone", "spirit_stone", "demon_bone"],
  },
  // 古妖：沉眠万载的太古妖兽被灵气扰动惊醒，鳞甲覆满古藤。
  {
    id: "ancient_beast",
    name: "古妖",
    realm: "元婴期",
    combatPower: 8000,
    rarity: "BOSS",
    locationIds: ["wild"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "ancient_core", "fossil"],
  },
  {
    id: "ancient_spirit",
    name: "古修士残魂",
    realm: "元婴期",
    combatPower: 5000,
    rarity: "BOSS",
    locationIds: ["cave"],
    drops: ["spirit_stone", "spirit_stone", "broken_jade", "soul_fragment"],
  },
  {
    id: "fiend",
    name: "魔头",
    realm: "化神期",
    combatPower: 15000,
    rarity: "BOSS",
    locationIds: ["wild", "cave"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "demon_heart"],
  },
  // 虚空妖将：撕裂虚空的妖将前锋，周身萦绕空间裂隙的幽蓝微光。
  {
    id: "void_general",
    name: "虚空妖将",
    realm: "化神期",
    combatPower: 9000,
    rarity: "精英",
    locationIds: ["wild"],
    drops: ["spirit_stone", "spirit_stone", "void_shard"],
  },
  // 古魔：上古陨落魔修的执念残躯，吞噬灵气与生机，与魔头同源而异脉。
  {
    id: "ancient_fiend",
    name: "古魔",
    realm: "化神期",
    combatPower: 14000,
    rarity: "BOSS",
    locationIds: ["wild"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "ancient_demon_core", "void_essence"],
  },
  {
    id: "void_beast",
    name: "虚空兽",
    realm: "炼虚期",
    combatPower: 50000,
    rarity: "BOSS",
    locationIds: ["wild"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "void_core"],
  },
  {
    id: "celestial",
    name: "天界使者",
    realm: "合体期",
    combatPower: 150000,
    rarity: "BOSS",
    locationIds: ["cave"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "celestial_feather"],
  },
  {
    id: "dao_guardian",
    name: "道界守护者",
    realm: "大乘期",
    combatPower: 500000,
    rarity: "BOSS",
    locationIds: ["cave"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "dao_fragment"],
  },
  {
    id: "immortal",
    name: "真仙投影",
    realm: "渡劫期",
    combatPower: 1000000,
    rarity: "BOSS",
    locationIds: ["cave"],
    drops: ["spirit_stone", "spirit_stone", "spirit_stone", "immortal_essence"],
  },
];

const SAFE_LOCATIONS = ["home", "kindergarten", "school"];

/**
 * 获取某地点的敌人（安全地点返回空数组）。
 * 过滤规则：只返回与玩家境界差 ≤ 2 的敌人（粗筛候选池，精细缩放交给 pickEnemy 加权）。
 */
export function getEnemiesForLocation(locationId: string, playerRealm: string): Enemy[] {
  if (SAFE_LOCATIONS.includes(locationId)) return [];
  const pool = ENEMIES.filter((e) => e.locationIds.includes(locationId));
  return pool.filter((e) => Math.abs(getRealmIndex(e.realm) - getRealmIndex(playerRealm)) <= 2);
}

/** 获取境界索引 */
export function getRealmIndex(realm: string): number {
  const idx = REALM_ORDER.indexOf(realm);
  return idx >= 0 ? idx : 0;
}

/** 境界系数：1.5 ^ 境界索引 */
export function getRealmMultiplier(realm: string): number {
  return Math.pow(1.5, getRealmIndex(realm));
}

/**
 * 选取一个敌人。
 * - 未传 playerPower：均匀随机（保持旧行为，供测试/特殊场景）。
 * - 传入 playerPower：按「敌力与玩家战力接近度」加权轮盘抽取，
 *   weight = 1 / (1 + |ln(敌力 / max(1, 玩家力))|)，
 *   使大多数战斗落在玩家战力 0.6×~1.8× 区间，消除均匀随机导致的
 *   「抽到远超自身敌人 → 战败即道消」的 RNG 死亡陷阱。
 */
export function pickEnemy(enemies: Enemy[], playerPower?: number): Enemy | null {
  if (enemies.length === 0) return null;
  if (playerPower === undefined) {
    return enemies[Math.floor(Math.random() * enemies.length)];
  }
  // 动态缩放：只在与玩家战力 0.3×~3× 区间内的敌人中加权，杜绝「抽到远超自身敌人 → 战败即道消」的 RNG 秒杀；
  // 区间外敌人权重置 0，确保大多数战斗落在 0.6×~1.8×。
  const inBand = enemies.filter((e) => {
    const r = e.combatPower / Math.max(1, playerPower);
    return r >= 0.3 && r <= 3;
  });
  const pool = inBand.length > 0 ? inBand : enemies;
  const weights = pool.map((e) => {
    const r = e.combatPower / Math.max(1, playerPower);
    return 1 / (1 + Math.abs(Math.log(r)));
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
