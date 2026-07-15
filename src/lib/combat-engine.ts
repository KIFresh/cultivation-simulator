// ============================================================
// 战斗引擎
// ============================================================

import { getItemById } from "./cultivation-data";
import { Enemy, getEnemiesForLocation, getRealmMultiplier, pickEnemy } from "./enemy-data";
import { calculateTechniqueBonuses, TECHNIQUES } from "./technique-data";
import { generateCombatNarrative } from "./narrative";

export interface CombatResult {
  win: boolean;
  style: "overwhelm" | "hard_fought" | "underdog" | "comedy" | "crushed";
  enemy: Enemy;
  loot?: { gold: number; exp: number; items?: string[] };
  penalty?: { goldLoss: number; injuryDebuff: number; lifespanLoss: number; itemLoss?: string[]; daoXiao?: boolean };
  narrative: string;
}

export interface PlayerCombatData {
  cultivator: { id: string; name: string; realm: string; realmLevel: number; gold: number; reincarnationCount: number; injuryDebuff: number };
  attributes: Record<string, number>;
  equippedItems: { itemId: string }[];
  techniqueRecords: { techniqueId: string; level: number }[];
}

/** 玩家名称取巧（没有就用id）*/
function playerName(player: PlayerCombatData): string {
  return player.cultivator.name || player.cultivator.id;
}

/**
 * 计算玩家战力
 */
export function calculateCombatPower(player: PlayerCombatData): number {
  const attr = player.attributes;
  const base = Math.max(10, (attr.root || 0) * 2 + (attr.spirit || 0) * 1.5 + (attr.insight || 0) * 1);
  const realmMult = getRealmMultiplier(player.cultivator.realm);
  const techBonuses = calculateTechniqueBonuses(
    player.techniqueRecords.map((r) => ({ technique: TECHNIQUES[r.techniqueId], level: r.level }))
  );
  const techniqueBonus = 1 + (techBonuses.combat || 0) / 100;
  const equipmentBonus = 1 + player.equippedItems.reduce((sum, e) => {
    const item = getItemById(e.itemId);
    return sum + (item?.combatValue || 0);
  }, 0) / 100;
  return Math.floor(base * realmMult * techniqueBonus * equipmentBonus);
}

/**
 * 胜负判定
 */
export function resolveBattle(playerPower: number, enemyPower: number): { win: boolean; style: CombatResult["style"] } {
  const ratio = playerPower / enemyPower;
  if (ratio >= 5) return { win: true, style: "overwhelm" };
  const winRate = playerPower / (playerPower + enemyPower);
  const win = Math.random() < winRate;
  let style: CombatResult["style"];
  if (win) {
    if (winRate >= 0.7) style = "overwhelm";
    else if (winRate >= 0.3) style = "hard_fought";
    else style = "underdog";
  } else {
    if (winRate >= 0.7) style = "comedy";
    else style = "crushed";
  }
  return { win, style };
}

/**
 * 战利品生成
 */
export function generateLoot(enemy: Enemy, playerLuck: number): { gold: number; exp: number; items: string[] } {
  const power = enemy.combatPower;
  const gold = Math.floor(power * (0.5 + Math.random() * 1.0));
  const exp = Math.floor(power * (2 + Math.random() * 1));
  const items: string[] = [];
  const baseDropRate = enemy.rarity === "普通" ? 0.05 : enemy.rarity === "精英" ? 0.15 : 0.30;
  const luckRate = baseDropRate * (1 + (playerLuck || 0) * 0.1);
  // 单次判定，最多掉落1个
  if (Math.random() < luckRate) items.push("spirit_stone");
  return { gold, exp, items };
}

/**
 * 战败惩罚（按设计文档 §4）
 * ratio < 1  → 档0: 丢5-10%灵石 + 道心受损1次 (injuryDebuff=1)
 * 1 ≤ ratio < 2 → 档1: 丢20-50%灵石 + 丢1-2件物品 (无 injuryDebuff)
 * 2 ≤ ratio < 5 → 档2: 丢50-80%灵石 + 重伤3次 (injuryDebuff=3) + 扣5-10年寿元
 * ratio ≥ 5 → 档3: 道消
 */
export function applyPenalty(ratio: number, playerGold: number): {
  goldLoss: number; injuryDebuff: number; lifespanLoss: number; daoXiao: boolean; itemLoss?: string[]
} {
  if (ratio < 1) return { goldLoss: Math.floor(playerGold * (0.05 + Math.random() * 0.05)), injuryDebuff: 1, lifespanLoss: 0, daoXiao: false };
  if (ratio < 2) return { goldLoss: Math.floor(playerGold * (0.2 + Math.random() * 0.3)), injuryDebuff: 0, lifespanLoss: 0, daoXiao: false, itemLoss: [] };
  if (ratio < 5) return { goldLoss: Math.floor(playerGold * (0.5 + Math.random() * 0.3)), injuryDebuff: 3, lifespanLoss: 5 + Math.floor(Math.random() * 5), daoXiao: false };
  return { goldLoss: Math.floor(playerGold * 0.8), injuryDebuff: 0, lifespanLoss: 0, daoXiao: true };
}

/**
 * 获取战斗叙事风格
 */
export function getCombatNarrativeText(
  style: CombatResult["style"], win: boolean,
  playerName: string, enemyName: string
): string {
  if (style === "overwhelm" && win) return `${playerName}随手一挥，剑气纵横，${enemyName}当场灰飞烟灭。`;
  if (style === "hard_fought" && win) return `鏖战三百回合，${playerName}抓住破绽一剑封喉，${enemyName}轰然倒地。`;
  if (style === "underdog" && win) return `绝境中${playerName}引爆丹田潜能，一拳轰碎${enemyName}！`;
  if (style === "comedy") return `${playerName}被一块石头绊倒，${enemyName}一脸困惑地看着你。`;
  return `${playerName}连${enemyName}的衣角都没碰到就被打飞出去。`;
}

/**
 * 主入口：执行完整战斗流程
 */
export async function resolveCombat(
  player: PlayerCombatData,
  enemyId?: string,
  locationId?: string
): Promise<CombatResult> {
  let enemy: Enemy | null = null;
  if (enemyId) {
    const { ENEMIES } = await import("./enemy-data");
    enemy = ENEMIES.find((e) => e.id === enemyId) || null;
  } else if (locationId) {
    const enemies = getEnemiesForLocation(locationId, player.cultivator.realm);
    enemy = pickEnemy(enemies);
  }
  if (!enemy) {
    return {
      win: true, style: "overwhelm",
      enemy: { id: "none", name: "无", realm: "凡人", combatPower: 0, rarity: "普通", locationIds: [] },
      narrative: "四周一片宁静，并无敌人。",
    };
  }
  const playerPower = calculateCombatPower(player);
  const { win, style } = resolveBattle(playerPower, enemy.combatPower);
  const ratio = enemy.combatPower / Math.max(1, playerPower);
  const pname = playerName(player);
  let narrative = getCombatNarrativeText(style, win, pname, enemy.name);
  // Bug 12: 尝试 AI 叙事，失败用 fallback
  try {
    const aiText = await generateCombatNarrative({
      cultivatorName: pname,
      enemyName: enemy.name,
      result: win ? "win" : "lose",
      style,
      playerRealm: player.cultivator.realm,
      enemyRealm: enemy.realm,
    });
    if (aiText && aiText.trim()) narrative = aiText;
  } catch {}
  if (win) {
    const loot = generateLoot(enemy, player.attributes.luck || 0);
    return { win: true, style, enemy, loot, narrative };
  } else {
    const penalty = applyPenalty(ratio, player.cultivator.gold);
    return { win: false, style, enemy, penalty, narrative };
  }
}