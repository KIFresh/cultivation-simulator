// ============================================================
// 心魔系统
// ============================================================

/**
 * 心魔值阈值：>= 50 时每次行动有 心魔值/2% 概率触发心魔事件
 */
const MIND_DEMON_THRESHOLD = 50;

/**
 * 心魔事件效果类型
 */
export interface MindDemonEvent {
  triggered: boolean;
  staminaLoss?: number;
  expLoss?: number;
  narrative?: string;
}

/**
 * 检查心魔是否触发
 * @param mindDemon 当前心魔值
 * @returns 心魔事件数据
 */
export function checkMindDemon(mindDemon: number): MindDemonEvent {
  if (mindDemon < MIND_DEMON_THRESHOLD) return { triggered: false };

  const triggerChance = mindDemon / 2; // 百分比概率
  if (Math.random() * 100 >= triggerChance) return { triggered: false };

  // 随机心魔类型
  const type = Math.random();
  if (type < 0.4) {
    // 体力消耗型：心魔幻境消耗额外体力
    const staminaLoss = 2 + Math.floor(Math.random() * 4);
    return {
      triggered: true,
      staminaLoss,
      narrative: `【心魔反噬】幻境之中，往昔的种种遗憾与恐惧涌现心头。心神耗尽，额外消耗了 ${staminaLoss} 点体力。`,
    };
  } else if (type < 0.8) {
    // 修为倒退型：心魔扰动灵力
    const expLoss = 5 + Math.floor(Math.random() * 16);
    return {
      triggered: true,
      expLoss,
      narrative: `【心魔扰动】灵力失控，逆行经脉！一阵剧痛过后，修炼所得竟消散了 ${expLoss} 点。`,
    };
  } else {
    // 双重打击型
    const staminaLoss = 1 + Math.floor(Math.random() * 3);
    const expLoss = 3 + Math.floor(Math.random() * 8);
    return {
      triggered: true,
      staminaLoss,
      expLoss,
      narrative: `【心魔爆发】识海中阴风怒号，万千幻象扑面而来。体力 −${staminaLoss}，修炼值 −${expLoss}。`,
    };
  }
}

/**
 * 心魔值操作函数
 */
export const MIND_DEMON_EFFECTS = {
  /** 突破失败 */
  breakthroughFail: 15,
  /** 道心受损（战斗喜剧翻车） */
  comedyDefeat: 10,
  /** 连续战斗胜利（每次） */
  consecutiveWin: 5,
  /** 愈灵符 */
  healTalisman: -20,
  /** 洞府闭关 */
  seclusion: -5,
  /** 突破成功 */
  breakthroughSuccess: -30,
  /** 轮回清零 */
  reincarnationReset: 0,
} as const;

/**
 * 检查战斗连胜触发心魔
 * @param recentCombatWins 近期战斗胜利次数
 * @returns 应增加的心魔值
 */
export function calcCombatMindDemon(recentCombatWins: number): number {
  if (recentCombatWins < 3) return 0;
  // 连续 3 次以上胜利才开始累积
  return (recentCombatWins - 2) * MIND_DEMON_EFFECTS.consecutiveWin;
}