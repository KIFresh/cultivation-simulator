// P2#10 宠物系统（M4 生活功能）
// 凡人期（earth）在 6 岁边界自动获得一只种子随机宠物；之后每年成长、亲密度缓慢自然增长。
// 宠物状态存 cultivator.pet JSON。纯逻辑零 DB。

export type PetType = "cat" | "dog" | "rabbit" | "bird" | "turtle";

export interface PetState {
  type: PetType;
  name: string;
  intimacy: number; // 0-100
  petAge: number; // 岁（按年成长）
  acquiredAge: number;
}

export interface PetAcquireInfo {
  icon: string;
  label: string;
  flavor: string;
  name: string;
}

export const PET_ACQUIRE_AGE = 6;

export const PET_TYPES: { key: PetType; label: string; icon: string; flavor: string }[] = [
  { key: "cat", label: "猫", icon: "🐱", flavor: "它蜷在窗台，尾巴尖一勾一勾，像在打量你的灵气。" },
  { key: "dog", label: "狗", icon: "🐶", flavor: "它摇着尾巴绕你转圈，仿佛认定你就是全世界。" },
  {
    key: "rabbit",
    label: "兔",
    icon: "🐰",
    flavor: "它竖着长耳啃菜叶，三瓣嘴一动一动，煞是可爱。",
  },
  { key: "bird", label: "鸟", icon: "🐦", flavor: "它站在你肩头叽叽喳喳，偶尔啄一下你的耳垂。" },
  {
    key: "turtle",
    label: "龟",
    icon: "🐢",
    flavor: "它慢吞吞爬过手心，背甲凉凉的，出奇地让人安心。",
  },
];

const PET_NAMES: Record<PetType, string[]> = {
  cat: ["橘灯", "墨团", "雪球", "阿狸"],
  dog: ["大黄", "旺财", "黑豆", "可乐"],
  rabbit: ["棉花", "团子", "月牙", "糯糯"],
  bird: ["啾啾", "青羽", "小翠", "风铃"],
  turtle: ["磐磐", "老慢", "壳壳", "山川"],
};

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 解析 pet 字段（JSON 字符串）为 PetState；容错返回 null。 */
export function parsePet(s?: string | null): PetState | null {
  if (!s) return null;
  try {
    const o = JSON.parse(s) as Partial<PetState>;
    if (o && typeof o.type === "string" && typeof o.intimacy === "number") {
      return o as PetState;
    }
    return null;
  } catch {
    return null;
  }
}

/** 按种子随机生成一只宠物（同角色同年龄恒定）。 */
export function rollPet(id: string, age: number): PetState {
  const rng = mulberry32(hashSeed(`${id}:${age}:pet`));
  const type = PET_TYPES[Math.floor(rng() * PET_TYPES.length)].key;
  const names = PET_NAMES[type];
  const name = names[Math.floor(rng() * names.length)];
  return { type, name, intimacy: 50, petAge: 0, acquiredAge: age };
}

/** 每年成长：年龄 +1，亲密度自然 +2（clamp 0-100）。 */
export function growPet(pet: PetState): PetState {
  return {
    ...pet,
    petAge: pet.petAge + 1,
    intimacy: Math.max(0, Math.min(100, pet.intimacy + 2)),
  };
}

/** 取宠物获取展示信息（图标/称呼/风味/名字）。 */
export function getPetAcquireInfo(pet: PetState): PetAcquireInfo {
  const meta = PET_TYPES.find((p) => p.key === pet.type);
  return {
    icon: meta?.icon ?? "🐾",
    label: meta?.label ?? "宠物",
    flavor: meta?.flavor ?? "",
    name: pet.name,
  };
}
