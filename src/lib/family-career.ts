import { CAREER_CATEGORIES as WORLD_CAREER_CATEGORIES, getWorldEra, type CareerCategory } from "./world-era";

export const CAREER_CATEGORIES = WORLD_CAREER_CATEGORIES;
export type { CareerCategory };
export type CareerStatus = "employed" | "unemployed" | "retired";

/** 0=拮据, 1=普通, 2=小康/中性, 3=殷实, 4=富裕 */
export const NEUTRAL_FAMILY_ECONOMIC_BACKGROUND = 2;

export interface FamilyCareer {
  relation: string;
  age: number;
  alive: boolean;
  careerCategory: CareerCategory;
  careerLevel: number;
  careerStatus: CareerStatus;
  monthlyIncome: number;
  incomeLevel: number;
  careerUpdatedYear: number | null;
}

export interface HouseholdIncome {
  monthlyIncome: number;
  incomeLevel: number;
  contributingMembers: number;
}

export interface InitializeFamilyCareerInput {
  relation: string;
  age: number;
  worldYear: number;
  familyBackground?: number | string;
  /** AI occupation is only a category hint; an invalid hint falls back deterministically. */
  categoryHint?: string;
  /** Server-side callers may supply a bounded starting level. */
  levelHint?: number;
  alive?: boolean;
}

const BASE_INCOME: Record<CareerCategory, number> = {
  agriculture: 2800,
  manufacturing: 3500,
  education: 4200,
  healthcare: 4600,
  public_service: 4300,
  business: 5000,
  service: 3200,
  freelance: 3800,
};

const LEVEL_MULTIPLIERS = [1, 1.28, 1.65, 2.15, 2.85] as const;
const FAMILY_GUARDIAN_RELATIONS = new Set(["父亲", "爸爸", "母亲", "妈妈", "监护人"]);

/** 单一家庭经济口径：父母称谓别名与监护人均视为可承担家庭责任的监护人。 */
export function isFamilyGuardianRelation(relation: string | null | undefined): boolean {
  return typeof relation === "string" && FAMILY_GUARDIAN_RELATIONS.has(relation.trim());
}

const DISPLAY_NAMES: Record<CareerCategory, readonly string[]> = {
  agriculture: ["农务学徒", "种植户", "农技骨干", "农场主管", "农业负责人"],
  manufacturing: ["车间学徒", "熟练工", "技术骨干", "车间主管", "制造负责人"],
  education: ["助教", "教师", "中学教师", "资深教师", "教育负责人"],
  healthcare: ["护理学徒", "护士", "资深护士", "科室专家", "医疗负责人"],
  public_service: ["基层办事员", "事务专员", "业务骨干", "部门主管", "公共服务负责人"],
  business: ["店员", "业务员", "小店主", "经营主管", "企业负责人"],
  service: ["服务学徒", "服务员", "服务骨干", "门店主管", "服务负责人"],
  freelance: ["自由职业新手", "自由职业者", "资深自由职业者", "行业专家", "工作室负责人"],
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roll(seed: string): number {
  return hashSeed(seed) / 0x100000000;
}

function familyBackgroundLevel(value: number | string | undefined): number {
  if (typeof value === "number") return Math.max(0, Math.min(4, Math.floor(value)));
  if (typeof value === "string") {
    if (/富|豪|显赫|世家/.test(value)) return 4;
    if (/小康|书香|商贾|殷实/.test(value)) return 3;
    if (/拮据|贫|寒门|困/.test(value)) return 0;
  }
  return 2;
}

function clampLevel(level: number): number {
  return Math.max(0, Math.min(4, Math.floor(level)));
}

function isCareerCategory(value: string | undefined): value is CareerCategory {
  return !!value && (CAREER_CATEGORIES as readonly string[]).includes(value);
}

function categoryFromHint(hint: string | undefined, seed: string): CareerCategory {
  if (isCareerCategory(hint)) return hint;

  const normalized = hint?.trim() ?? "";
  const mappings: Array<[string, CareerCategory]> = [
    ["农", "agriculture"], ["工", "manufacturing"], ["教师", "education"], ["学校", "education"],
    ["医", "healthcare"], ["护", "healthcare"], ["公务", "public_service"], ["政府", "public_service"],
    ["店", "business"], ["商", "business"], ["服务", "service"], ["自由", "freelance"],
  ];
  const matched = mappings.find(([keyword]) => normalized.includes(keyword));
  return matched?.[1] ?? CAREER_CATEGORIES[hashSeed(seed) % CAREER_CATEGORIES.length];
}

function incomeFor(category: CareerCategory, level: number, worldYear: number, status: CareerStatus): number {
  if (status !== "employed") return 0;
  const era = getWorldEra(worldYear);
  const categoryMultiplier = era.careerWeights[category] ?? 1;
  return Math.max(0, Math.round(BASE_INCOME[category] * LEVEL_MULTIPLIERS[clampLevel(level)] * era.incomeMultiplier * categoryMultiplier));
}

/** Returns the localized, deterministic display name for a valid category and 0–4 career level. */
export function getCareerDisplayName(category: CareerCategory, level: number, _era: number): string {
  return DISPLAY_NAMES[category][clampLevel(level)];
}

/** Converts concrete monthly household income into the legacy 0–4 income level. */
export function getIncomeLevel(monthlyIncome: number, household?: Pick<HouseholdIncome, "contributingMembers">): number {
  const contributors = Math.max(1, household?.contributingMembers ?? 1);
  const perContributor = Math.max(0, monthlyIncome) / contributors;
  if (perContributor < 2500) return 0;
  if (perContributor < 4500) return 1;
  if (perContributor < 7500) return 2;
  if (perContributor < 12000) return 3;
  return 4;
}

export function initializeFamilyCareer(input: InitializeFamilyCareerInput): FamilyCareer {
  const alive = input.alive ?? true;
  const background = familyBackgroundLevel(input.familyBackground);
  const category = categoryFromHint(input.categoryHint, `${input.relation}|${input.worldYear}|${background}`);
  const level = clampLevel(input.levelHint ?? Math.max(0, background - 1));
  const status: CareerStatus = !alive || input.age >= 65 ? "retired" : input.age < 18 ? "unemployed" : "employed";
  const monthlyIncome = incomeFor(category, level, input.worldYear, status);

  return {
    relation: input.relation,
    age: input.age,
    alive,
    careerCategory: category,
    careerLevel: level,
    careerStatus: status,
    monthlyIncome,
    incomeLevel: getIncomeLevel(monthlyIncome),
    careerUpdatedYear: input.worldYear,
  };
}

export function evolveFamilyCareer(input: { career: FamilyCareer; memberAge: number; worldYear: number; seed: string }): FamilyCareer {
  const { career, memberAge, worldYear, seed } = input;
  if (career.careerUpdatedYear === worldYear) return { ...career };

  let status: CareerStatus = career.careerStatus;
  let level = clampLevel(career.careerLevel);
  if (!career.alive || memberAge >= 65) {
    status = "retired";
  } else if (memberAge < 18) {
    status = "unemployed";
  } else if (status === "retired") {
    status = "retired";
  } else if (status === "unemployed") {
    const stability = career.careerCategory === "public_service" || career.careerCategory === "healthcare" ? 0.55 : 0.38;
    if (roll(`${seed}|reemployment`) < stability) status = "employed";
  } else {
    const retirementProbability = memberAge >= 60 ? (memberAge - 59) * 0.08 : 0;
    if (roll(`${seed}|retirement`) < retirementProbability) status = "retired";
  }

  if (status === "employed" && roll(`${seed}|promotion`) < 0.08 + level * 0.015) {
    level = clampLevel(level + 1);
  }
  const monthlyIncome = incomeFor(career.careerCategory, level, worldYear, status);
  return {
    ...career,
    age: memberAge,
    careerLevel: level,
    careerStatus: status,
    monthlyIncome,
    incomeLevel: getIncomeLevel(monthlyIncome),
    careerUpdatedYear: worldYear,
  };
}

/** Aggregates only living employed parents or guardians. */
export function calculateHouseholdIncome(members: FamilyCareer[]): HouseholdIncome {
  const contributors = members.filter((member) => (
    member.alive && member.careerStatus === "employed" && isFamilyGuardianRelation(member.relation)
  ));
  const monthlyIncome = contributors.reduce((total, member) => total + Math.max(0, member.monthlyIncome), 0);
  return {
    monthlyIncome,
    contributingMembers: contributors.length,
    incomeLevel: getIncomeLevel(monthlyIncome, { contributingMembers: contributors.length }),
  };
}
