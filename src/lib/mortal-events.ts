// 凡人时期随机事件：日常 / 饭桌 / 节日 / 考试。
// 被 src/app/api/resolve-event/route.ts 与 __tests__/exam.test.ts 使用。

export interface MortalEventOption {
  effects: Record<string, number>;
  narrative: string;
  gold?: number;
  familyEffects?: { parentIntimacy?: number };
}

export interface MortalEvent {
  id: string;
  text: string;
  options: MortalEventOption[];
  ageBand?: "7-12" | "13-15";
}

// 日常随机事件
export const MORTAL_EVENTS: MortalEvent[] = [
  {
    id: "m_stray_cat",
    text: "巷口有只瘦猫朝你喵喵叫。",
    options: [
      { effects: { charm: 5 }, narrative: "你蹲下喂了它一口饼干，猫咪蹭了蹭你的手。" },
      { effects: { mind: -5 }, narrative: "你嫌它吵，绕道走了，心里有点烦躁。" },
    ],
  },
  {
    id: "m_lucky_coin",
    text: "路边水洼里闪着一枚硬币。",
    options: [
      { effects: { luck: 5 }, gold: 5, narrative: "你捡起硬币，今天似乎顺风顺水。" },
      { effects: {}, narrative: "你没去管它，继续赶路。" },
    ],
  },
  {
    id: "m_neighbor_kid",
    text: "邻家小孩拉你比弹珠。",
    options: [
      { effects: { insight: 5 }, narrative: "你教他瞄准的诀窍，自己也悟了点门道。" },
      { effects: { charm: -5 }, narrative: "你赢了所有弹珠，他哭着跑了。" },
    ],
  },
  {
    id: "m_rain_book",
    text: "下雨天，书摊在清仓。",
    options: [
      { effects: { insight: 5 }, gold: -3, narrative: "你花零钱淘了本旧书，津津有味。" },
      { effects: {}, narrative: "你嫌贵，没买。" },
    ],
  },
  {
    id: "m_grandma_soup",
    text: "楼下奶奶端来一碗汤。",
    options: [
      { effects: { health: 3, charm: 5 }, narrative: "热汤下肚，浑身舒坦。" },
      { effects: { health: 1 }, narrative: "你礼貌地喝了两口。" },
    ],
  },
];

// 饭桌事件
export const DINNER_EVENTS: MortalEvent[] = [
  {
    id: "d_praise",
    text: "饭桌上，父亲夸了你一句。",
    options: [
      { effects: { mind: 5 }, narrative: "你红了脸，心里甜滋滋的。" },
      { effects: {}, narrative: "你低头扒饭，没接话。" },
    ],
  },
  {
    id: "d_quarrel",
    text: "父母为琐事拌嘴。",
    options: [
      { effects: { mind: -5 }, narrative: "你缩了缩脖子，不太自在。" },
      { effects: { insight: 5 }, narrative: "你默默劝开二老，竟有点小大人模样。" },
    ],
  },
  {
    id: "d_new_dish",
    text: "桌上多了道没见过的菜。",
    options: [
      { effects: { charm: 5 }, gold: -2, narrative: "你抢着尝鲜，还夸了厨艺。" },
      { effects: { health: 1 }, narrative: "你只夹了一筷子。" },
    ],
  },
];

// 节日事件
export const FESTIVAL_EVENTS: MortalEvent[] = [
  {
    id: "f_newyear",
    text: "新年，长辈塞来红包。",
    options: [
      { effects: { luck: 10 }, gold: 20, narrative: "红包厚实，你乐得合不拢嘴。" },
      { effects: { mind: 10 }, narrative: "你乖巧地拜了年，得了句夸奖。" },
    ],
  },
  {
    id: "f_lantern",
    text: "元宵灯会，人山人海。",
    options: [
      { effects: { charm: 10, insight: 10 }, narrative: "你猜中灯谜，赢得一阵喝彩。" },
      { effects: { luck: -10 }, narrative: "你挤丢了鞋，悻悻而归。" },
    ],
  },
];

// 考试 / 家长会事件（按学段分层）
export const EXAM_EVENTS: MortalEvent[] = [
  {
    id: "e_primary_exam",
    text: "小学期中考试出分了。",
    ageBand: "7-12",
    options: [
      { effects: { insight: 10, mind: 10 }, narrative: "你考了双百，老师当众表扬。" },
      { effects: { mind: -10 }, narrative: "你马虎错了几题，被叫了家长。" },
    ],
  },
  {
    id: "e_primary_parents",
    text: "小学家长会，父母去了学校。",
    ageBand: "7-12",
    options: [
      {
        effects: { charm: 10 },
        familyEffects: { parentIntimacy: 3 },
        narrative: "父母听到夸奖，回家对你格外温柔。",
      },
      {
        effects: {},
        familyEffects: { parentIntimacy: 1 },
        narrative: "家长会平平淡淡，父母回来摸了摸你的头。",
      },
    ],
  },
  {
    id: "e_junior_exam",
    text: "初中月考排名公布。",
    ageBand: "13-15",
    options: [
      { effects: { insight: 15 }, narrative: "你冲进年级前十，意气风发。" },
      { effects: { mind: -10, insight: 0 }, narrative: "名次下滑，你暗暗较劲。" },
    ],
  },
  {
    id: "e_junior_parents",
    text: "初中家长会，老师约谈。",
    ageBand: "13-15",
    options: [
      {
        effects: { mind: 10 },
        familyEffects: { parentIntimacy: 4 },
        narrative: "老师夸你懂事，父母与有荣焉。",
      },
      {
        effects: { insight: -10 },
        familyEffects: { parentIntimacy: -2 },
        narrative: "老师委婉提醒贪玩，父母回家黑着脸。",
      },
    ],
  },
];

/**
 * 按年龄抽取一场考试事件。
 * - <7 或 >=16：返回 null（学龄前 / 已觉醒后不再有考试）
 * - exclude：要排除的事件 id 列表；若排除后为空则回退到全池
 */
export function pickExamEvent(age: number, exclude?: string[]): MortalEvent | null {
  if (age < 7 || age >= 16) return null;
  const band: "7-12" | "13-15" = age <= 12 ? "7-12" : "13-15";
  let pool = EXAM_EVENTS.filter((e) => e.ageBand === band);
  if (exclude && exclude.length > 0) {
    const filtered = pool.filter((e) => !exclude.includes(e.id));
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
