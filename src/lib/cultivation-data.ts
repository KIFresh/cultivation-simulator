// ============================================================
// 修仙模拟器 — 修炼体系数据
// ============================================================

/** 灵根类型 */
export type SpiritualRoot =
  | "杂灵根"    // 五灵根伪灵根
  | "四灵根"
  | "三灵根"
  | "双灵根"
  | "异灵根"    // 雷/冰/风
  | "天灵根";   // 单一纯灵根

export interface SpiritualRootInfo {
  name: SpiritualRoot;
  description: string;
  rarity: number;       // 稀有度 1-5
  speedBonus: number;   // 修炼速度加成倍率
  color: string;        // 显示颜色
  element: string;      // 五行属性
}

/** 灵根数据 */
export const SPIRITUAL_ROOTS: Record<SpiritualRoot, SpiritualRootInfo> = {
  "杂灵根": {
    name: "杂灵根",
    description: "五行俱全却无一突出，修炼速度最为缓慢，但根基扎实",
    rarity: 1,
    speedBonus: 1.0,
    color: "#8B7355",
    element: "五行俱全",
  },
  "四灵根": {
    name: "四灵根",
    description: "四属性灵根，修炼速度稍快，胜在属性互补",
    rarity: 2,
    speedBonus: 1.1,
    color: "#6B8E6B",
    element: "四属性",
  },
  "三灵根": {
    name: "三灵根",
    description: "三种属性灵根，修炼速度中等，是最常见的修仙者",
    rarity: 2,
    speedBonus: 1.2,
    color: "#4A90D9",
    element: "三属性",
  },
  "双灵根": {
    name: "双灵根",
    description: "两种属性相辅相成，修炼速度上佳，被各派视为可造之材",
    rarity: 3,
    speedBonus: 1.3,
    color: "#9B59B6",
    element: "双属性",
  },
  "异灵根": {
    name: "异灵根",
    description: "雷、冰、风等变异属性，修炼速度极快，万中无一",
    rarity: 4,
    speedBonus: 1.4,
    color: "#E74C3C",
    element: "变异属性",
  },
  "天灵根": {
    name: "天灵根",
    description: "单一纯属性灵根，天道垂青，修炼速度冠绝天下，传说级资质",
    rarity: 5,
    speedBonus: 1.5,
    color: "#F1C40F",
    element: "单一纯属性",
  },
};

// ============================================================
// 修炼境界体系（基于凡人修仙传设定）
// ============================================================

export interface Realm {
  name: string;           // 境界名称
  levels: number;         // 层数
  expRequired: number;    // 第1层所需修炼值
  expIncrement: number;   // 每层递增
  lifespan: string;       // 寿元
  description: string;
}

/** 修炼境界（下境界 + 上境界） */
export const REALMS: Realm[] = [
  {
    name: "炼气期",
    levels: 13,
    expRequired: 50,
    expIncrement: 10,
    lifespan: "百岁",
    description: "引天地灵气入体，淬炼肉身经脉，踏上修仙之路",
  },
  {
    name: "筑基期",
    levels: 3,
    expRequired: 600,
    expIncrement: 300,
    lifespan: "二百余岁",
    description: "筑就道基，灵力凝实，从此仙凡有别",
  },
  {
    name: "结丹期",
    levels: 3,
    expRequired: 1500,
    expIncrement: 700,
    lifespan: "五百余岁",
    description: "凝结金丹，法力大增，可御器飞行，纵横一方",
  },
  {
    name: "元婴期",
    levels: 3,
    expRequired: 3500,
    expIncrement: 1500,
    lifespan: "千余岁",
    description: "碎丹成婴，元神初成，可元婴出窍遨游天地",
  },
  {
    name: "化神期",
    levels: 3,
    expRequired: 8000,
    expIncrement: 3500,
    lifespan: "两千余岁",
    description: "元婴化神，与天地共鸣，神通广大，人界巅峰",
  },
  {
    name: "炼虚期",
    levels: 3,
    expRequired: 18000,
    expIncrement: 8000,
    lifespan: "五千余岁",
    description: "炼神还虚，破碎虚空，可飞升灵界",
  },
  {
    name: "合体期",
    levels: 3,
    expRequired: 40000,
    expIncrement: 18000,
    lifespan: "万余岁",
    description: "法体合一，举手投足皆可引动天地之力",
  },
  {
    name: "大乘期",
    levels: 3,
    expRequired: 90000,
    expIncrement: 40000,
    lifespan: "数万岁",
    description: "大道初成，万法归一，灵界亦为一方霸主",
  },
  {
    name: "渡劫期",
    levels: 1,
    expRequired: 500000,
    expIncrement: 0,
    lifespan: "与天地同寿",
    description: "渡过天劫，飞升仙界，从此跳出三界外不在五行中",
  },
];

// ============================================================
// 任务类型
// ============================================================

export interface TaskType {
  id: string;
  name: string;
  icon: string;
  description: string;
  baseExp: number;
  cultivationName: string;  // 修炼对应名称
  dailyMax: number;         // 每日上限
  limitReason: string;      // 上限提示
}

export const TASK_TYPES: Record<string, TaskType> = {
  STUDY: {
    id: "STUDY",
    name: "悟道",
    icon: "📖",
    description: "读书学习，参悟天地至理",
    baseExp: 20,
    cultivationName: "静坐悟道，灵台清明",
    dailyMax: 3,
    limitReason: "今日悟道已尽——学海无涯，留些余地明日再参",
  },
  EXERCISE: {
    id: "EXERCISE",
    name: "锻体",
    icon: "💪",
    description: "锻炼体魄，淬炼肉身",
    baseExp: 25,
    cultivationName: "运转功法，淬炼肉身",
    dailyMax: 2,
    limitReason: "今日锻体已至极限——过犹不及，肉身需休养",
  },
  SLEEP: {
    id: "SLEEP",
    name: "静修",
    icon: "😴",
    description: "早睡养神，蓄养灵力",
    baseExp: 15,
    cultivationName: "抱元守一，蕴养元神",
    dailyMax: 1,
    limitReason: "今日静修已足——一夜好眠胜过百年苦修",
  },
  MEDITATE: {
    id: "MEDITATE",
    name: "打坐",
    icon: "🧘",
    description: "冥想打坐，感悟天道",
    baseExp: 30,
    cultivationName: "五心朝天，感悟天地灵气",
    dailyMax: 2,
    limitReason: "今日打坐已圆满——心神需沉淀，明日再入定",
  },
  WORK: {
    id: "WORK",
    name: "上班",
    icon: "💼",
    description: "红尘历练，搬砖赚灵石",
    baseExp: 25,
    cultivationName: "红尘炼心，以劳入道",
    dailyMax: 2,
    limitReason: "今日搬砖已足——红尘虽苦亦是修行，明日再战",
  },
  CUSTOM: {
    id: "CUSTOM",
    name: "历练",
    icon: "⚔️",
    description: "自定义修炼任务",
    baseExp: 20,
    cultivationName: "随心而修，道法自然",
    dailyMax: 2,
    limitReason: "今日历练已足——随心所欲不逾矩，明日再行",
  },
};

// ============================================================
// 境界突破动画名称
// ============================================================

export const BREAKTHROUGH_ANIMATIONS: Record<string, string> = {
  "炼气期": "灵气如潮，涌入体内，丹田之中渐渐凝聚出一缕真气……",
  "筑基期": "道基初成！周身经脉贯通，灵力如江河奔涌，仙凡之隔从此打破！",
  "结丹期": "金丹凝结！天地灵气疯狂涌入，一枚灿若星辰的金丹在丹田中缓缓旋转……",
  "元婴期": "元婴出世！金丹碎裂，一个与你一般无二的元婴破丹而出，仰天长啸！",
  "化神期": "化神之境！元婴与天地共鸣，举手投足间，仿佛能引动这一方天地的法则之力！",
  "炼虚期": "破碎虚空！空间在眼前扭曲，灵界的气息隐隐传来，飞升之路已在脚下展开！",
  "合体期": "法体合一！肉身与元神完美融合，天地为之变色，日月为之无光！",
  "大乘期": "大道初成！万千法则尽在掌握，一念可令山河倒转，一怒可叫星辰破碎！",
  "渡劫期": "天劫降临！九天神雷轰然而下，渡过此劫便可飞升仙界，永享仙福！",
};

// ============================================================
// NPC 角色池
// ============================================================

export interface NPC {
  name: string;
  title: string;
  realm: string;
  personality: string;
  greeting: string;
  avatar: string;
}

export const NPCS: NPC[] = [
  {
    name: "韩立",
    title: "韩老魔",
    realm: "大乘期",
    personality: "谨慎低调，心思缜密，杀伐果断，重情重义",
    greeting: "在下韩立，一介散修。修仙之路凶险，道友须步步为营。",
    avatar: "🧘",
  },
  {
    name: "南宫婉",
    title: "南宫仙子",
    realm: "化神期",
    personality: "清冷孤傲，外冷内热，天资卓绝",
    greeting: "修仙之路漫漫，能在此相遇，也算有缘。",
    avatar: "🌸",
  },
  {
    name: "墨彩环",
    title: "墨府千金",
    realm: "筑基期",
    personality: "活泼灵动，古灵精怪，心向大道",
    greeting: "道友道友！你是从哪里来的？可曾见过外面的世界？",
    avatar: "🦋",
  },
  {
    name: "银月",
    title: "银月妖女",
    realm: "化神期",
    personality: "妖媚狡黠，实力深不可测，亦正亦邪",
    greeting: "呵呵，又一个来送死的？……开个玩笑，道友莫怪。",
    avatar: "🌙",
  },
  {
    name: "大衍神君",
    title: "大衍老人",
    realm: "大乘期",
    personality: "神秘莫测，智慧通神，喜怒不形于色",
    greeting: "老夫观你根骨……嗯，倒是有几分意思。",
    avatar: "🔮",
  },
  {
    name: "紫灵",
    title: "紫灵仙子",
    realm: "元婴期",
    personality: "温婉大方，心地善良，出身名门",
    greeting: "修仙之道，贵在坚持。道友若有疑惑，紫灵愿尽绵薄之力。",
    avatar: "💜",
  },
];

// ============================================================
// 辅助函数
// ============================================================

/** 获取当前境界信息 */
export function getCurrentRealm(realmName: string): Realm | undefined {
  return REALMS.find((r) => r.name === realmName);
}

/** 获取下一个境界 */
export function getNextRealm(realmName: string): Realm | undefined {
  const idx = REALMS.findIndex((r) => r.name === realmName);
  return idx >= 0 && idx < REALMS.length - 1 ? REALMS[idx + 1] : undefined;
}

/** 计算当前层突破所需修炼值 */
export function getRequiredExp(realmName: string, realmLevel: number): number {
  const realm = getCurrentRealm(realmName);
  if (!realm) return 100;
  return realm.expRequired + (realmLevel - 1) * realm.expIncrement;
}

/** 计算任务修炼值（含灵根加成） */
export function calculateTaskExp(
  taskType: string,
  spiritualRoot: SpiritualRoot
): number {
  const task = TASK_TYPES[taskType];
  if (!task) return 10;
  const rootInfo = SPIRITUAL_ROOTS[spiritualRoot];
  return Math.floor(task.baseExp * rootInfo.speedBonus);
}

/** 检查是否可以突破 */
export function canBreakthrough(
  realmName: string,
  realmLevel: number,
  cultivationExp: number,
  spiritualRoot: SpiritualRoot
): boolean {
  const realm = getCurrentRealm(realmName);
  if (!realm) return false;

  // 当前境界最高层 → 检查能否突破到下一个大境界
  if (realmLevel >= realm.levels) {
    const nextRealm = getNextRealm(realmName);
    if (!nextRealm) return false;
    return cultivationExp >= getRequiredExp(realmName, realmLevel);
  }

  // 同一境界内升级
  return cultivationExp >= getRequiredExp(realmName, realmLevel);
}

/** 突破后返回新状态（溢出修炼值保留） */
export function performBreakthrough(
  realmName: string,
  realmLevel: number,
  cultivationExp: number
): { newRealm: string; newLevel: number; newExp: number } | null {
  const realm = getCurrentRealm(realmName);
  if (!realm) return null;

  const required = getRequiredExp(realmName, realmLevel);

  if (realmLevel < realm.levels) {
    // 在当前境界升级，溢出保留
    return {
      newRealm: realmName,
      newLevel: realmLevel + 1,
      newExp: cultivationExp - required,
    };
  }

  // 突破到下一个大境界，溢出保留
  const nextRealm = getNextRealm(realmName);
  if (!nextRealm) return null;

  return {
    newRealm: nextRealm.name,
    newLevel: 1,
    newExp: cultivationExp - required,
  };
}
