// P1#9 成长里程碑（M4 生活功能）
// 凡人阶段（earth）在边界季（跨年）按 newAge 触发「成长里程碑」叙事节点。
// 里程碑是叙事节拍，无选项；推进引擎查表、未触发过则生成，写入 milestones 字段去重。
// 现代都市修仙风格文案（与 mortal-events / narrative 基调一致）。

export interface MilestoneInfo {
  id: string;
  age: number; // 触发年龄（整数岁，边界季 newAge）
  title: string;
  icon: string;
  narrative: string; // 预制文本，禁用 AI
}

// 每个年龄至多一个里程碑；以 age 为键，保证每岁唯一、去重简单。
// 覆盖 1-15 岁关键节点（16 为灵气觉醒，由 advance-quarter 单独处理，不在此列）。
export const MILESTONES_BY_AGE: Record<number, MilestoneInfo> = {
  1: {
    id: "ms_birthday_1",
    age: 1,
    title: "周岁宴",
    icon: "🎂",
    narrative:
      "你人生的第一个生日。全家围着你唱跑调的歌，妈妈把一小坨奶油抹在你鼻尖上，你咯咯笑得眼睛弯成月牙。这一岁，你从一团软软的婴儿，长成了会认人、会撒娇的小家伙。",
  },
  3: {
    id: "ms_nursery",
    age: 3,
    title: "初入幼儿园",
    icon: "🎒",
    narrative:
      "爸妈把你送到幼儿园门口，你死死攥着妈妈的衣角不肯撒手。老师蹲下来递给你一块积木，说「我们一起搭城堡呀」。那天你第一次在没有爸妈的屋子里，待了整整半天。",
  },
  6: {
    id: "ms_primary",
    age: 6,
    title: "背上小书包",
    icon: "📘",
    narrative:
      "你换下背心，穿上了小学校服，书包里塞着新铅笔盒。校门口人声鼎沸，你被人群推着往前走，回头望时，爸妈还站在原地冲你挥手。从今天起，世界好像大了一圈。",
  },
  8: {
    id: "ms_young_pioneer",
    age: 8,
    title: "红领巾",
    icon: "🏅",
    narrative:
      "你在操场排成一列，高年级的哥哥把一条鲜红的红领巾系在你颈上。你挺直腰板行了个歪歪扭扭的队礼，回家路上连蹦带跳，觉得自己是小小的大人了。",
  },
  10: {
    id: "ms_double_digits",
    age: 10,
    title: "两位数生日",
    icon: "🔟",
    narrative:
      "你吹灭了十根蜡烛。十岁——你忽然觉得自己「长大了」，不再肯让爸爸牵着手过马路，却在黑灯瞎火的卧室里，还是偷偷把脚缩进了被窝。",
  },
  12: {
    id: "ms_graduation_primary",
    age: 12,
    title: "小学毕业",
    icon: "🎓",
    narrative:
      "你站在礼堂台上，胸口别着「优秀毕业生」的纸花。六年同窗在合影里挤作一团，你悄悄把最要好的那个名字，写在了课本扉页。下一站，是更大的校园。",
  },
  14: {
    id: "ms_puberty",
    age: 14,
    title: "生长痛",
    icon: "🌱",
    narrative:
      "这年你蹿高了大半个头，裤脚一夜之间短了一截。声音开始变得古怪，心里像住了两个小人，一个想听话、一个想往外跑。你第一次在镜子里，认不出那个半大不小的自己。",
  },
  15: {
    id: "ms_junior",
    age: 15,
    title: "步入初中",
    icon: "📚",
    narrative:
      "你踏进中学大门，课程表密得像地图。新同学、新老师、新规矩扑面而来，你攥着书包带站在走廊尽头，深吸一口气——少年的篇章，正翻到最热闹的一页。",
  },
};

/** 解析 milestones 字段（JSON 字符串数组）为 id 列表；容错返回空数组。 */
export function parseMilestones(s?: string | null): string[] {
  if (!s) return [];
  try {
    const o = JSON.parse(s);
    return Array.isArray(o) ? o.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 取某年龄应触发的里程碑（已触发则跳过）。
 * 仅年龄表命中且 id 未出现在 triggeredIds 中时返回；否则 null。
 */
export function getMilestoneForAge(age: number, triggeredIds: string[] = []): MilestoneInfo | null {
  const ms = MILESTONES_BY_AGE[age];
  if (!ms) return null;
  if (triggeredIds.includes(ms.id)) return null;
  return ms;
}

/** 是否应在该年龄触发里程碑（便于调用方判断，无需拿对象）。 */
export function shouldTriggerMilestone(age: number, triggeredIds: string[] = []): boolean {
  return getMilestoneForAge(age, triggeredIds) !== null;
}
