// ============================================================
// 修仙模拟器 — 家庭成员生成工具
// ============================================================

export interface FamilyMember {
  id: string;
  relation: string;
  name: string;
  age: number;
  alive: boolean;
  personality?: string;
  intimacy: number;
  dialogueHistory: FamilyDialogueEntry[];
}

export interface FamilyDialogueEntry {
  role: "player" | "npc";
  content: string;
  timestamp: number;
}

export interface FamilyData {
  members: FamilyMember[];
}

const SURNAMES = ["张", "李", "王", "刘", "陈", "杨", "赵", "黄", "周", "吴",
  "徐", "孙", "马", "胡", "朱", "郭", "何", "罗", "高", "林"];
const MALE_GIVEN = ["建国", "伟", "强", "磊", "军", "勇", "明", "平", "建华", "志强",
  "海", "涛", "斌", "浩", "鹏", "飞", "鑫", "宇", "杰", "文"];
const FEMALE_GIVEN = ["芳", "敏", "静", "丽", "娟", "婷", "玲", "雪", "燕", "红",
  "萍", "娜", "霞", "琴", "玉", "慧", "秀英", "琳", "瑶", "萱"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p: number): boolean { return Math.random() < p; }

function generatePersonName(isMale: boolean): string {
  const surname = pick(SURNAMES);
  const given = isMale ? pick(MALE_GIVEN) : pick(FEMALE_GIVEN);
  if (chance(0.3)) return surname + given.slice(0, 1) + pick(["小", "子", "大", "阿"]);
  return surname + given;
}

let familyIdCounter = 0;
function nextFamilyId(): string { return `fam_${Date.now()}_${++familyIdCounter}`; }

export function generateEarthFamily(cultivatorAge: number, identity: string): FamilyData {
  const members: FamilyMember[] = [];
  if (identity === "orphan") return { members };
  if (chance(0.85)) {
    const fatherAge = cultivatorAge + (24 + Math.floor(Math.random() * 17));
    const motherAge = cultivatorAge + (22 + Math.floor(Math.random() * 17));
    members.push({ id: nextFamilyId(), relation: "父亲", name: generatePersonName(true), age: fatherAge, alive: chance(0.85), intimacy: 50, dialogueHistory: [] });
    members.push({ id: nextFamilyId(), relation: "母亲", name: generatePersonName(false), age: motherAge, alive: chance(0.88), intimacy: 55, dialogueHistory: [] });
    const maxParentAgeForSibling = 40;
    const canHaveSiblings = (fatherAge - cultivatorAge) <= maxParentAgeForSibling || (motherAge - cultivatorAge) <= maxParentAgeForSibling;
    if (canHaveSiblings) {
      let siblingCount = 0;
      if (chance(0.6)) siblingCount = 1;
      if (chance(0.2)) siblingCount = 2;
      for (let i = 0; i < siblingCount; i++) {
        const isOlder = chance(0.45);
        const isMale = chance(0.5);
        const ageDiff = isOlder ? 1 + Math.floor(Math.random() * 8) : 1 + Math.floor(Math.random() * 5);
        const relation = isMale ? (isOlder ? "哥哥" : "弟弟") : (isOlder ? "姐姐" : "妹妹");
        const siblingAge = isOlder ? cultivatorAge + ageDiff : Math.max(1, cultivatorAge - ageDiff);
        const aliveChance = isOlder ? 0.92 : 0.98;
        const isAlive = siblingAge <= 3 ? true : chance(aliveChance);
        members.push({ id: nextFamilyId(), relation, name: generatePersonName(isMale), age: siblingAge, alive: isAlive, intimacy: 50, dialogueHistory: [] });
      }
    }
  }
  return { members };
}

export function decayIntimacy(family: FamilyData, excludeIds: string[] = [], amount?: number): { updated: FamilyData; changes: { name: string; relation: string; delta: number }[] } {
  const changes: { name: string; relation: string; delta: number }[] = [];
  const updated: FamilyData = { members: family.members.map((m) => {
    if (excludeIds.includes(m.id)) return m;
    const decayAmount = amount ?? (2 + Math.floor(Math.random() * 2));
    const newIntimacy = Math.max(0, m.intimacy - decayAmount);
    changes.push({ name: m.name, relation: m.relation, delta: newIntimacy - m.intimacy });
    return { ...m, intimacy: newIntimacy };
  })};
  return { updated, changes };
}