/**
 * 世界事件池与触发逻辑
 * 静态池 + AI 叙事融入，事件系统只决定"发生了什么事"，
 * AI 负责写"具体怎么发生的"。
 */

export interface WorldEventDef {
  id: string;
  title: string;
  stage: "凡人" | "觉醒";
  pool: "celestial" | "rumor" | "news" | "tide" | "beast" | "secret_realm" | "auction";
  trigger: { prob: number };
  duration: number;
  effect?: { attrBonus?: Record<string, number>; speedBonus?: number };
  description: string;
}

// ============================================================
// 凡人阶段事件池
// ============================================================

const PRE_AWAKENING_EVENTS: WorldEventDef[] = [
  // 🌠 天降异象
  {
    id: "meteor_shower",
    title: "百年一遇的流星雨",
    stage: "凡人",
    pool: "celestial",
    trigger: { prob: 0.01 },
    duration: 1,
    effect: { attrBonus: { insight: 2 } },
    description: "夜空中划过异常明亮的流星雨，天文台称这是百年一遇的天象。你望着星空，心中涌起一种说不清道不明的感觉。",
  },
  {
    id: "strange_flower",
    title: "奇花绽放",
    stage: "凡人",
    pool: "celestial",
    trigger: { prob: 0.01 },
    duration: 1,
    effect: { attrBonus: { insight: 1 } },
    description: "市中心公园一夜之间开出一片从未见过的花，花瓣在月光下泛着微光。植物专家也无法辨认品种。",
  },
  // 🗣️ 都市传闻
  {
    id: "antique_shop",
    title: "古董店老板",
    stage: "凡人",
    pool: "rumor",
    trigger: { prob: 0.01 },
    duration: 1,
    effect: { attrBonus: { insight: 2 } },
    description: "街角的古董店老板说你'骨骼清奇'，塞给你一本破旧的书，说'你以后用得着'。",
  },
  {
    id: "midnight_elevator",
    title: "深夜电梯",
    stage: "凡人",
    pool: "rumor",
    trigger: { prob: 0.01 },
    duration: 1,
    description: "深夜回家，电梯在非对应楼层停下了。门打开，外面空无一人，走廊灯忽明忽暗。",
  },
  {
    id: "park_old_man",
    title: "公园老人",
    stage: "凡人",
    pool: "rumor",
    trigger: { prob: 0.01 },
    duration: 1,
    effect: { attrBonus: { luck: 1 } },
    description: "公园里下棋的老人抬头看了你一眼，随口说了句'你命里带点东西'，然后专注下棋不再说话。",
  },
  {
    id: "stray_cat",
    title: "引路猫",
    stage: "凡人",
    pool: "rumor",
    trigger: { prob: 0.01 },
    duration: 1,
    description: "一只三花猫一直跟在你回家的路上，在你停下来看它时，它转身走了几步，回头看你，像是在等你跟上。",
  },
  // 📰 新闻热点
  {
    id: "extreme_weather",
    title: "极端天气",
    stage: "凡人",
    pool: "news",
    trigger: { prob: 0.02 },
    duration: 1,
    description: "气象台发布极端天气预警，学校停课，公司建议居家办公。窗外风雨大作。",
  },
  {
    id: "tech_breakthrough",
    title: "科技突破",
    stage: "凡人",
    pool: "news",
    trigger: { prob: 0.02 },
    duration: 1,
    effect: { attrBonus: { insight: 1 } },
    description: "新闻联播报道某实验室在量子计算领域取得突破性进展，专家称这将改变人类文明进程。",
  },
  {
    id: "school_policy",
    title: "升学政策调整",
    stage: "凡人",
    pool: "news",
    trigger: { prob: 0.02 },
    duration: 1,
    description: "市教育局发布新的升学政策，学校召开紧急家长会，同学们议论纷纷。",
  },
];

// ============================================================
// 觉醒后额外事件池
// ============================================================

const POST_AWAKENING_EVENTS: WorldEventDef[] = [
  {
    id: "spiritual_tide",
    title: "灵气潮汐",
    stage: "觉醒",
    pool: "tide",
    trigger: { prob: 0.08 },
    duration: 2,
    effect: { speedBonus: 0.2 },
    description: "天地间灵气如潮水般涌动，修炼速度显著提升。这是灵气复苏世界中正常的能量波动。",
  },
  {
    id: "beast_disturbance",
    title: "妖兽骚动",
    stage: "觉醒",
    pool: "beast",
    trigger: { prob: 0.02 },
    duration: 1,
    description: "城郊出现异常生物活动，疑似妖兽出没。修仙者论坛上已经有人发布了悬赏信息。",
  },
  {
    id: "secret_realm",
    title: "秘境现世",
    stage: "觉醒",
    pool: "secret_realm",
    trigger: { prob: 0.05 },
    duration: 2,
    description: "古代修士洞府意外现世，灵气波动引起了各方势力的注意。据说其中有珍贵的传承和宝物。",
  },
  {
    id: "auction",
    title: "拍卖盛会",
    stage: "觉醒",
    pool: "auction",
    trigger: { prob: 0.06 },
    duration: 1,
    description: "地下修仙者拍卖会即将举行，据说这次有珍品出现。入场资格有限。",
  },
];

/** 获取所有事件定义 */
export function getAllEventDefs(): WorldEventDef[] {
  return [...PRE_AWAKENING_EVENTS, ...POST_AWAKENING_EVENTS];
}

/** 根据阶段获取可触发的事件池 */
export function getEventPool(stage: "凡人" | "觉醒"): WorldEventDef[] {
  return stage === "凡人" ? PRE_AWAKENING_EVENTS : [...PRE_AWAKENING_EVENTS, ...POST_AWAKENING_EVENTS];
}

/** 尝试触发事件，返回触发的事件列表 */
export function rollEvents(
  stage: "凡人" | "觉醒",
  activeEventIds: string[],
  currentYear: number
): WorldEventDef[] {
  const pool = getEventPool(stage);
  const triggered: WorldEventDef[] = [];

  for (const def of pool) {
    // 跳过已在活跃中的事件
    if (activeEventIds.includes(def.id)) continue;

    const rand = Math.random();
    if (rand < def.trigger.prob) {
      triggered.push(def);
    }
  }

  return triggered;
}