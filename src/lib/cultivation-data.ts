// ============================================================
// 修仙模拟器 — 修炼体系数据
// ============================================================

export type SpiritualRoot = "杂灵根" | "四灵根" | "三灵根" | "双灵根" | "异灵根" | "天灵根";

export interface SpiritualRootInfo {
  name: string; description: string; rarity: number;
  speedBonus: number; color: string; element: string; quality?: string;
}

const OLD_ROOTS: Record<string, SpiritualRootInfo> = {
  "杂灵根": { name: "杂灵根", description: "五行俱全却无一突出，修炼速度最为缓慢", rarity: 1, speedBonus: 1.0, color: "#8B7355", element: "五行俱全" },
  "四灵根": { name: "四灵根", description: "四属性灵根，修炼速度稍快", rarity: 2, speedBonus: 1.1, color: "#6B8E6B", element: "四属性" },
  "三灵根": { name: "三灵根", description: "三种属性灵根，修炼速度中等", rarity: 2, speedBonus: 1.2, color: "#4A90D9", element: "三属性" },
  "双灵根": { name: "双灵根", description: "两种属性相辅相成", rarity: 3, speedBonus: 1.3, color: "#9B59B6", element: "双属性" },
  "异灵根": { name: "异灵根", description: "雷、冰、风等变异属性", rarity: 4, speedBonus: 1.4, color: "#E74C3C", element: "变异属性" },
  "天灵根": { name: "天灵根", description: "单一纯属性灵根，天道垂青", rarity: 5, speedBonus: 1.5, color: "#F1C40F", element: "单一纯属性" },
};

const ELEMENT_MAP: Record<string, { icon: string; color: string }> = {
  "金": { icon: "🔱", color: "#FFD700" }, "木": { icon: "🌿", color: "#4CAF50" },
  "水": { icon: "💧", color: "#2196F3" }, "火": { icon: "🔥", color: "#FF5722" }, "土": { icon: "⛰️", color: "#8D6E63" },
};
const QUALITY_MAP: Record<string, { multiplier: number; rarity: number }> = {
  "上品": { multiplier: 1.6, rarity: 5 }, "中品": { multiplier: 1.3, rarity: 3 }, "下品": { multiplier: 1.0, rarity: 2 },
};
const NEW_ROOT_MAP: Record<string, { element: string; quality: string; multiplier: number; color: string }> = {};
for (const [el, info] of Object.entries(ELEMENT_MAP)) {
  for (const [q, qInfo] of Object.entries(QUALITY_MAP)) {
    NEW_ROOT_MAP[`${el}_${q}`] = { element: el, quality: q, multiplier: qInfo.multiplier, color: info.color };
  }
}
NEW_ROOT_MAP["chaos"] = { element: "五行杂灵根", quality: "凡品", multiplier: 0.2, color: "#607D8B" };

export const SPIRITUAL_ROOTS: Record<string, SpiritualRootInfo> = new Proxy({} as any, {
  get(_, key: string) {
    if (OLD_ROOTS[key]) return OLD_ROOTS[key];
    const n = NEW_ROOT_MAP[key];
    if (n) return { name: key === "chaos" ? n.element : key, description: `${n.element} · ${n.quality}，修炼速度 ${n.multiplier}x`, rarity: QUALITY_MAP[n.quality]?.rarity ?? 1, speedBonus: n.multiplier, color: n.color, element: n.element, quality: n.quality };
    return undefined;
  },
});

export function getRootInfo(rootKey: string): SpiritualRootInfo {
  return SPIRITUAL_ROOTS[rootKey] || { name: rootKey, description: "", rarity: 1, speedBonus: 1.0, color: "#8B7355", element: "未知" };
}

// ============================================================
// 修炼境界
// ============================================================
export const MORTAL_REALM = "凡人";
export function isAwakened(realm: string): boolean { return realm !== MORTAL_REALM; }

export interface Realm { name: string; levels: number; expRequired: number; expIncrement: number; lifespan: string; description: string; }

export const REALMS: Realm[] = [
  { name: "炼气期", levels: 13, expRequired: 50, expIncrement: 10, lifespan: "百岁", description: "引天地灵气入体，踏上修仙之路" },
  { name: "筑基期", levels: 3, expRequired: 600, expIncrement: 300, lifespan: "二百余岁", description: "筑就道基，仙凡有别" },
  { name: "结丹期", levels: 3, expRequired: 1500, expIncrement: 700, lifespan: "五百余岁", description: "凝结金丹，法力大增" },
  { name: "元婴期", levels: 3, expRequired: 3500, expIncrement: 1500, lifespan: "千余岁", description: "碎丹成婴，元神初成" },
  { name: "化神期", levels: 3, expRequired: 8000, expIncrement: 3500, lifespan: "两千余岁", description: "元婴化神，人界巅峰" },
  { name: "炼虚期", levels: 3, expRequired: 18000, expIncrement: 8000, lifespan: "五千余岁", description: "炼神还虚，可飞升灵界" },
  { name: "合体期", levels: 3, expRequired: 40000, expIncrement: 18000, lifespan: "万余岁", description: "法体合一" },
  { name: "大乘期", levels: 3, expRequired: 90000, expIncrement: 40000, lifespan: "数万岁", description: "大道初成，万法归一" },
  { name: "渡劫期", levels: 1, expRequired: 500000, expIncrement: 0, lifespan: "与天地同寿", description: "渡过天劫，飞升仙界" },
];

const LEVEL_LABELS: Record<number, string> = { 1: "初期", 2: "中期", 3: "后期" };
const LIANQI_LABELS: Record<number, string> = { 1:"第一层",2:"第二层",3:"第三层",4:"第四层",5:"第五层",6:"第六层",7:"第七层",8:"第八层",9:"第九层",10:"第十层",11:"第十一层",12:"第十二层",13:"第十三层" };

export function formatRealmLevel(realmName: string, level: number): string {
  if (realmName === MORTAL_REALM) return "";
  if (realmName === "炼气期") return LIANQI_LABELS[level] ?? `第${level}层`;
  return LEVEL_LABELS[level] ?? `第${level}期`;
}
export function getCurrentRealm(realmName: string): Realm | undefined { return realmName === MORTAL_REALM ? undefined : REALMS.find((r) => r.name === realmName); }
export function getNextRealm(realmName: string): Realm | undefined {
  if (realmName === MORTAL_REALM) return REALMS[0];
  const idx = REALMS.findIndex((r) => r.name === realmName);
  return idx >= 0 && idx < REALMS.length - 1 ? REALMS[idx + 1] : undefined;
}
export function getRequiredExp(realmName: string, realmLevel: number): number {
  if (realmName === MORTAL_REALM) return 50;
  const realm = getCurrentRealm(realmName);
  return realm ? realm.expRequired + (realmLevel - 1) * realm.expIncrement : 100;
}
export function canBreakthrough(realmName: string, realmLevel: number, cultivationExp: number, _spiritualRoot: string): boolean {
  if (realmName === MORTAL_REALM) return false;
  const realm = getCurrentRealm(realmName);
  if (!realm) return false;
  if (realmLevel >= realm.levels) {
    const nextRealm = getNextRealm(realmName);
    if (!nextRealm) return false;
    return cultivationExp >= getRequiredExp(realmName, realmLevel);
  }
  return cultivationExp >= getRequiredExp(realmName, realmLevel);
}
export function performBreakthrough(realmName: string, realmLevel: number, cultivationExp: number): { newRealm: string; newLevel: number; newExp: number } | null {
  if (realmName === MORTAL_REALM) return null;
  const realm = getCurrentRealm(realmName);
  if (!realm) return null;
  const required = getRequiredExp(realmName, realmLevel);
  if (realmLevel < realm.levels) return { newRealm: realmName, newLevel: realmLevel + 1, newExp: cultivationExp - required };
  const nextRealm = getNextRealm(realmName);
  if (!nextRealm) return null;
  return { newRealm: nextRealm.name, newLevel: 1, newExp: cultivationExp - required };
}

// ============================================================
// 行动体系
// ============================================================
export interface Action { id: string; name: string; icon: string; description: string; actionPointCost: number; baseExp: number; category: "cultivate" | "explore" | "social" | "rest" | "free"; minAgeEarth: number; narrativeTag: string; }

export const ACTIONS: Action[] = [
  { id: "MEDITATE", name: "打坐修炼", icon: "🧘", description: "盘膝而坐，引天地灵气入体", actionPointCost: 5, baseExp: 30, category: "cultivate", minAgeEarth: 16, narrativeTag: "cultivate" },
  { id: "BREATHE", name: "吐纳练气", icon: "🌬️", description: "调整呼吸，以气引气", actionPointCost: 3, baseExp: 15, category: "cultivate", minAgeEarth: 16, narrativeTag: "cultivate" },
  { id: "EXPLORE", name: "外出历练", icon: "⚔️", description: "踏出洞府，探索未知之地", actionPointCost: 8, baseExp: 40, category: "explore", minAgeEarth: 16, narrativeTag: "explore" },
  { id: "ALCHEMY", name: "炼丹制药", icon: "🔥", description: "采集灵草，开炉炼丹", actionPointCost: 6, baseExp: 25, category: "cultivate", minAgeEarth: 16, narrativeTag: "cultivate" },
  { id: "STUDY", name: "研读功法", icon: "📖", description: "翻阅古籍，参悟功法奥义", actionPointCost: 3, baseExp: 20, category: "cultivate", minAgeEarth: 16, narrativeTag: "study" },
  { id: "SECLUSION", name: "洞府闭关", icon: "🏔️", description: "封闭洞府，潜心苦修", actionPointCost: 10, baseExp: 60, category: "cultivate", minAgeEarth: 16, narrativeTag: "cultivate" },
  { id: "TALK", name: "与人交谈", icon: "💬", description: "与身边的人交谈", actionPointCost: 2, baseExp: 5, category: "social", minAgeEarth: 1, narrativeTag: "social" },
  { id: "WANDER", name: "四处闲逛", icon: "🚶", description: "随意走走", actionPointCost: 2, baseExp: 3, category: "explore", minAgeEarth: 1, narrativeTag: "wander" },
  { id: "FREE", name: "自由探索", icon: "✨", description: "随心所欲，自由行动", actionPointCost: 2, baseExp: 10, category: "free", minAgeEarth: 1, narrativeTag: "free" },
];

export function getAvailableActions(worldId: string, age: number): Action[] {
  return ACTIONS.filter((a) => worldId === "earth" ? age >= a.minAgeEarth : true);
}
export function getActionById(actionId: string): Action | undefined { return ACTIONS.find((a) => a.id === actionId); }
export function calculateActionExp(actionId: string, spiritualRoot: string, attributes?: Record<string, number>): number {
  const action = ACTIONS.find((a) => a.id === actionId);
  if (!action) return 5;
  const base = action.baseExp * getRootInfo(spiritualRoot).speedBonus;
  // 灵性加成：每点灵性 +5% 修炼速度
  const spiritBonus = attributes ? 1 + (attributes.spirit || 0) * 0.05 : 1;
  return Math.floor(base * spiritBonus);
}

// ============================================================
// 物品系统
// ============================================================
export type ItemCategory = "weapon" | "armor" | "accessory" | "pill" | "material" | "talisman" | "treasure";
export interface Item { id: string; name: string; icon: string; category: ItemCategory; description: string; effect?: string; }
export interface InventoryItem { itemId: string; quantity: number; equipped: boolean; }

export const ITEMS: Record<string, Item> = {
  wooden_sword: { id: "wooden_sword", name: "木剑", icon: "🗡️", category: "weapon", description: "一柄普通的桃木剑", effect: "攻击+2" },
  iron_sword: { id: "iron_sword", name: "铁剑", icon: "⚔️", category: "weapon", description: "精铁打造的利剑", effect: "攻击+5" },
  spirit_sword: { id: "spirit_sword", name: "灵剑", icon: "🔮", category: "weapon", description: "刻有灵纹的法剑", effect: "攻击+10" },
  cloth_armor: { id: "cloth_armor", name: "布衣", icon: "👘", category: "armor", description: "粗布外衣", effect: "防御+1" },
  leather_armor: { id: "leather_armor", name: "皮甲", icon: "🛡️", category: "armor", description: "兽皮轻甲", effect: "防御+3" },
  spirit_robe: { id: "spirit_robe", name: "法袍", icon: "🧙", category: "armor", description: "刻有灵纹的道袍", effect: "防御+6" },
  jade_pendant: { id: "jade_pendant", name: "玉佩", icon: "💚", category: "accessory", description: "温润的古玉", effect: "灵性+2" },
  spirit_beads: { id: "spirit_beads", name: "灵珠手串", icon: "📿", category: "accessory", description: "十二颗聚灵珠", effect: "修炼速度+10%" },
  storage_ring: { id: "storage_ring", name: "储物戒", icon: "💍", category: "accessory", description: "内含空间的戒指", effect: "背包+20格" },
  qi_pill: { id: "qi_pill", name: "益气丹", icon: "💊", category: "pill", description: "补充灵气的基础丹药", effect: "修炼值+20" },
  bone_pill: { id: "bone_pill", name: "锻骨丹", icon: "🧪", category: "pill", description: "淬炼筋骨的上品丹药", effect: "根骨+1" },
  breakthrough_pill: { id: "breakthrough_pill", name: "破境丹", icon: "💎", category: "pill", description: "辅助突破瓶颈", effect: "突破概率+15%" },
  spirit_grass: { id: "spirit_grass", name: "灵草", icon: "🌿", category: "material", description: "蕴含灵气的草药", effect: "炼丹材料" },
  spirit_stone: { id: "spirit_stone", name: "灵石", icon: "🪨", category: "material", description: "修仙界通用货币", effect: "交易用" },
  spirit_wood: { id: "spirit_wood", name: "灵木", icon: "🪵", category: "material", description: "蕴含灵气的木材", effect: "炼器材料" },
  demon_core: { id: "demon_core", name: "妖丹", icon: "🔴", category: "material", description: "妖兽内丹", effect: "炼丹材料" },
  talisman_shield: { id: "talisman_shield", name: "护身符", icon: "🪄", category: "talisman", description: "抵挡一次致命攻击", effect: "免死一次" },
  talisman_fire: { id: "talisman_fire", name: "火符", icon: "🔥", category: "talisman", description: "释放一次火球术", effect: "攻击+20" },
  talisman_heal: { id: "talisman_heal", name: "愈灵符", icon: "💚", category: "talisman", description: "恢复伤势的灵符", effect: "回复50%状态" },
  ancient_tome: { id: "ancient_tome", name: "古功法卷", icon: "📜", category: "treasure", description: "失传功法的古卷", effect: "领悟新功法" },
  compass: { id: "compass", name: "寻宝罗盘", icon: "🧭", category: "treasure", description: "感应宝物气息", effect: "探索宝物" },
  jade_slip: { id: "jade_slip", name: "玉简", icon: "📏", category: "treasure", description: "前辈修炼心得", effect: "悟性+3" },
};

export function getStarterInventory(): InventoryItem[] { return []; }
export function getItemById(itemId: string): Item | undefined { return ITEMS[itemId]; }
export function getEquippedItems(inventory: InventoryItem[]): InventoryItem[] { return inventory.filter((i) => i.equipped); }
export function getBackpackItems(inventory: InventoryItem[]): InventoryItem[] { return inventory.filter((i) => !i.equipped); }

// ============================================================
// 商店系统
// ============================================================

export interface ShopItem {
  itemId: string;
  price: number;
  category: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { itemId: "qi_pill", price: 15, category: "丹药" },
  { itemId: "bone_pill", price: 40, category: "丹药" },
  { itemId: "breakthrough_pill", price: 100, category: "丹药" },
  { itemId: "iron_sword", price: 50, category: "武器" },
  { itemId: "leather_armor", price: 40, category: "防具" },
  { itemId: "jade_pendant", price: 30, category: "饰品" },
  { itemId: "spirit_grass", price: 8, category: "材料" },
  { itemId: "spirit_wood", price: 12, category: "材料" },
  { itemId: "spirit_stone", price: 5, category: "材料" },
  { itemId: "talisman_shield", price: 60, category: "符箓" },
  { itemId: "talisman_fire", price: 45, category: "符箓" },
];

export function getShopItems(): (ShopItem & { item: Item })[] {
  return SHOP_ITEMS.map((s) => ({ ...s, item: ITEMS[s.itemId] })).filter((s) => s.item);
}
// 学校系统
// ============================================================
export interface SchoolStage { name: string; ageStart: number; ageEnd: number; years: number; examAge: number; }
export const SCHOOL_STAGES: SchoolStage[] = [
  { name: "幼儿园", ageStart: 3, ageEnd: 6, years: 3, examAge: 6 },
  { name: "小学", ageStart: 6, ageEnd: 12, years: 6, examAge: 12 },
  { name: "初中", ageStart: 12, ageEnd: 15, years: 3, examAge: 15 },
  { name: "高中", ageStart: 15, ageEnd: 18, years: 3, examAge: 18 },
  { name: "大学", ageStart: 18, ageEnd: 22, years: 4, examAge: -1 },
];
export type SchoolRank = "普通" | "重点" | "名校";
export interface SchoolInfo { rank: SchoolRank; name: string; attrMultiplier: number; }
export const SCHOOL_RANKS: Record<SchoolRank, SchoolInfo> = {
  "普通": { rank: "普通", name: "普通学校", attrMultiplier: 1.0 },
  "重点": { rank: "重点", name: "重点学校", attrMultiplier: 1.5 },
  "名校": { rank: "名校", name: "名校学府", attrMultiplier: 2.0 },
};
export function getSchoolStage(age: number): SchoolStage | null {
  for (const s of SCHOOL_STAGES) { if (age >= s.ageStart && age < s.ageEnd) return s; }
  return null;
}
export function getSchoolGrade(age: number, stage: SchoolStage): number { return age - stage.ageStart + 1; }
export function getDefaultOccupation(age: number): string {
  if (age < 3) return "婴儿";
  if (age < 22) return "学生";
  return "散修";
}

// ============================================================
// 突破动画 & NPC
// ============================================================
export const BREAKTHROUGH_ANIMATIONS: Record<string, string> = {
  "炼气期": "灵气如潮，涌入体内，丹田之中渐渐凝聚出一缕真气……",
  "筑基期": "道基初成！周身经脉贯通，灵力如江河奔涌！",
  "结丹期": "金丹凝结！一枚灿若星辰的金丹在丹田中缓缓旋转……",
  "元婴期": "元婴出世！金丹碎裂，元婴破丹而出，仰天长啸！",
  "化神期": "化神之境！元婴与天地共鸣，举手投足间引动法则之力！",
  "炼虚期": "破碎虚空！空间在眼前扭曲，飞升之路已在脚下展开！",
  "合体期": "法体合一！肉身与元神完美融合，天地为之变色！",
  "大乘期": "大道初成！万千法则尽在掌握，一念山河倒转！",
  "渡劫期": "天劫降临！九天神雷轰然而下，渡过此劫飞升仙界！",
};

export interface NPC { name: string; title: string; realm: string; personality: string; greeting: string; avatar: string; locationId: string; }
export const NPCS: NPC[] = [
  { name: "韩立", title: "韩老魔", realm: "大乘期", personality: "谨慎低调", greeting: "在下韩立，一介散修。", avatar: "🧘", locationId: "wild" },
  { name: "南宫婉", title: "南宫仙子", realm: "化神期", personality: "清冷孤傲", greeting: "修仙之路漫漫，能在此相遇也算有缘。", avatar: "🌸", locationId: "cave" },
  { name: "墨彩环", title: "墨府千金", realm: "筑基期", personality: "活泼灵动", greeting: "道友道友！你是从哪里来的？", avatar: "🦋", locationId: "school" },
  { name: "银月", title: "银月妖女", realm: "化神期", personality: "妖媚狡黠", greeting: "呵呵，又一个来送死的？", avatar: "🌙", locationId: "downtown" },
  { name: "大衍神君", title: "大衍老人", realm: "大乘期", personality: "神秘莫测", greeting: "老夫观你根骨……有几分意思。", avatar: "🔮", locationId: "market" },
  { name: "紫灵", title: "紫灵仙子", realm: "元婴期", personality: "温婉大方", greeting: "修仙之道，贵在坚持。", avatar: "💜", locationId: "home" },
];

/** 获取某地点的 NPC 列表 */
export function getNPCsAtLocation(locationId: string): NPC[] {
  return NPCS.filter((n) => n.locationId === locationId);
}
export function calculateSchoolRank(age: number, attributes: Record<string, number>): SchoolRank {
  const score = (attributes.insight || 0) * 3 + (attributes.mind || 0) * 2 + (attributes.root || 0) + (attributes.spirit || 0) + (attributes.luck || 0) * 1.5 + (attributes.charm || 0) * 0.5;
  const threshold = 15 * Math.min(1, age / 18);
  if (score >= threshold * 2) return "名校";
  if (score >= threshold) return "重点";
  return "普通";
}
export function getSchoolName(stage: SchoolStage, rank: SchoolRank): string {
  return { "普通": `${stage.name}（普通学区）`, "重点": `${stage.name}（重点学区）`, "名校": `市${stage.name === "大学" ? "名牌大学" : "第一${stage.name}"}` }[rank];
}

// ============================================================
// 地点系统
// ============================================================
export interface Location { id: string; name: string; icon: string; description: string; unlockAge: number; requireAwakened?: boolean; distanceFromHome: number; }
export const LOCATIONS: Location[] = [
  { id: "home", name: "家", icon: "🏠", description: "温馨的家", unlockAge: 0, distanceFromHome: 0 },
  { id: "kindergarten", name: "幼儿园", icon: "🧸", description: "启蒙教育的地方", unlockAge: 3, distanceFromHome: 1 },
  { id: "school", name: "学校", icon: "🏫", description: "学习知识的地方", unlockAge: 6, distanceFromHome: 2 },
  { id: "downtown", name: "市区", icon: "🏙️", description: "繁华的城市中心", unlockAge: 12, distanceFromHome: 4 },
  { id: "wild", name: "野外", icon: "🌲", description: "灵气充盈的野外", unlockAge: 16, distanceFromHome: 8, requireAwakened: true },
  { id: "cave", name: "洞府", icon: "🏔️", description: "闭关修炼的洞府", unlockAge: 16, distanceFromHome: 6, requireAwakened: true },
  { id: "market", name: "坊市", icon: "🏪", description: "修仙者交易市场", unlockAge: 16, distanceFromHome: 5, requireAwakened: true },
];
export function getUnlockedLocations(age: number, isAwakened: boolean, narrativeUnlocks: string[] = []): Location[] {
  return LOCATIONS.filter((loc) => narrativeUnlocks.includes(loc.id) || (loc.requireAwakened ? isAwakened && age >= loc.unlockAge : age >= loc.unlockAge));
}
export function calcTravelCost(fromLocId: string, toLocId: string): number {
  const from = LOCATIONS.find((l) => l.id === fromLocId);
  const to = LOCATIONS.find((l) => l.id === toLocId);
  return from && to ? Math.max(1, Math.abs(from.distanceFromHome - to.distanceFromHome)) : 1;
}
export function calculateMaxStamina(age: number, attributes?: Record<string, number>): number {
  let base: number;
  if (age <= 0) base = 5;
  else if (age >= 18) base = 20;
  else if (age < 6) base = Math.round(5 + (age / 6) * 6);
  else if (age < 12) base = Math.round(11 + ((age - 6) / 6) * 7);
  else base = Math.round(18 + ((age - 12) / 6) * 2);
  const rootBonus = attributes ? Math.round((attributes.root || 0) * 0.5) : 0;
  return base + rootBonus;
}

// ============================================================
// 属性系统
// ============================================================
export interface AttrInfo { key: string; icon: string; label: string; description: string; }
export const ATTR_INFO: AttrInfo[] = [
  { key: "root", icon: "🦴", label: "根骨", description: "决定气血上限、恢复速度、寿命上限。影响炼体修行、抗打击能力" },
  { key: "spirit", icon: "✨", label: "灵性", description: "决定灵气上限、吸收效率。影响修炼速度、法术威力" },
  { key: "insight", icon: "🧠", label: "悟性", description: "决定神识上限、学习效率。影响功法领悟、技能掌握速度" },
  { key: "luck", icon: "🍀", label: "气运", description: "决定各种概率、物品掉落品质。影响天材地宝获取、贵人相助" },
  { key: "charm", icon: "💫", label: "魅力", description: "决定初始好感度、社交加成。影响NPC互动、门派声望获取" },
  { key: "mind", icon: "💎", label: "心性", description: "决定心魔抗性、意志力。影响走火入魔抵抗、关键抉择" },
];

const ATTR_KEYS = ["root", "spirit", "insight", "luck", "charm", "mind"] as const;
export function calculateYearlyAttributeGrowth(oldAge: number, newAge: number, currentAttributes: Record<string, number>, schoolRank?: SchoolRank): Record<string, number> {
  const result = { ...currentAttributes };
  const multiplier = schoolRank ? (SCHOOL_RANKS[schoolRank]?.attrMultiplier ?? 1.0) : 1.0;
  const insightBonus = (currentAttributes.insight || 0) * 0.1 + 1;
  if (newAge <= 0 || oldAge >= 18) return result;
  const startAge = Math.max(0, oldAge), endAge = Math.min(18, newAge);
  for (let age = startAge; age < endAge; age++) {
    let totalGrowthForYear = (age < 6 ? 1 / 6 : age < 12 ? 5 / 6 : 4 / 6) * multiplier * insightBonus;
    if (totalGrowthForYear <= 0) continue;
    const totalCurrent = Object.values(result).reduce((a, b) => a + b, 0) || 1;
    for (const key of ATTR_KEYS) {
      const ratio = (result[key] || 0) / totalCurrent;
      result[key] = Math.round(((result[key] || 0) + Math.max(totalGrowthForYear * ratio, 0.05)) * 10) / 10;
    }
  }
  return result;
}

export function parseOccupationFromNarrative(narrative: string, currentOccupation: string): string | null {
  const keywords: [string, string][] = [["辍学","辍学"],["退学","辍学"],["毕业","毕业生"],["工作","上班族"],["打工","打工者"],["经商","商人"],["开店","商人"],["拜师","弟子"],["入门","弟子"],["宗门","弟子"],["炼丹","炼丹师"],["炼器","炼器师"],["医师","医师"],["教书","教书先生"],["从军","军人"],["入伍","军人"]];
  for (const [kw, occ] of keywords) { if (narrative.includes(kw)) return occ; }
  return null;
}

// ============================================================
// 日常活动系统
// ============================================================

export interface DailyActivity {
  id: string; name: string; icon: string; description: string;
  staminaCost: number; goldDelta: number;
  attrGrowth: [string, number][];
  minAge: number; requireAwakened?: boolean;
}

export const DAILY_ACTIVITIES: DailyActivity[] = [
  { id: "study",    name: "上课学习", icon: "📖", description: "认真听课，学习知识",  staminaCost: 3, goldDelta: 0, attrGrowth: [["spirit",1],["insight",1]], minAge: 6 },
  { id: "work",     name: "打工赚钱", icon: "💼", description: "辛勤工作赚取金币",  staminaCost: 4, goldDelta: 10, attrGrowth: [["root",0.5]], minAge: 12 },
  { id: "exercise", name: "锻炼身体", icon: "🏃", description: "强身健体，淬炼体魄",  staminaCost: 3, goldDelta: 0, attrGrowth: [["root",1.5]], minAge: 3 },
  { id: "socialize",name: "社交活动", icon: "💬", description: "与人交往，拓展人脉",  staminaCost: 2, goldDelta: 0, attrGrowth: [["charm",1]], minAge: 3 },
  { id: "explore",  name: "探索闲逛", icon: "🚶", description: "四处走走，寻找机缘",  staminaCost: 2, goldDelta: 2, attrGrowth: [["luck",0.5]], minAge: 3 },
  { id: "meditate", name: "打坐冥想", icon: "🧘", description: "静心打坐，提升心性",  staminaCost: 2, goldDelta: 0, attrGrowth: [["mind",1]], minAge: 6 },
  { id: "cultivate",name: "修炼灵气", icon: "✨", description: "引灵气入体，提升修为", staminaCost: 5, goldDelta: 0, attrGrowth: [], minAge: 16, requireAwakened: true },
];

export function getAvailableActivities(age: number, isAwakened: boolean): DailyActivity[] {
  return DAILY_ACTIVITIES.filter((a) => age >= a.minAge && (!a.requireAwakened || isAwakened));
}

export function applyActivityEffects(activity: DailyActivity, attributes: Record<string, number>): Record<string, number> {
  const result = { ...attributes };
  for (const [key, val] of activity.attrGrowth) result[key] = Math.round(((result[key] || 0) + val) * 10) / 10;
  return result;
}

export function getStartingGold(): number { return 50; }