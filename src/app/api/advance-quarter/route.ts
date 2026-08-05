import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { sanitizeAttributes } from "@/lib/utils";
import {
  calculateMaxStamina,
  canBreakthrough,
  getSchoolStage,
  getSchoolGrade,
  calculateSchoolRank,
  getSchoolName,
  getDefaultOccupation,
  calculateYearlyAttributeGrowth,
  dbToSchoolRank,
  schoolRankToDb,
  type SchoolRank,
  type SchoolStage,
} from "@/lib";
import { calculateMaxAge } from "@/lib/cultivation-data";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import {
  shouldGenerateClassmates,
  generateClassmates,
  type NpcRelationData,
} from "@/lib/classmate-data";
import { shouldGenerateTeachers, generateTeachers, getTeacherRankBonus } from "@/lib/teacher";
import { decideClique, getCliqueBonus, getCliqueInfo, type CliqueKey } from "@/lib/clique";
import { calcPocketMoney, calcSavingsInterest, type ParentLike } from "@/lib/savings";
import { calcQuarterlyHealthRecovery, checkHealthZero, MAX_HEALTH } from "@/lib/health";
import { parseClassEnroll, applyClassBenefits } from "@/lib/class-enroll";
import { calculateAnnualFamilyAllowance, type AllowanceParent } from "@/lib/family-allowance";
import {
  calculateHouseholdIncome,
  evolveFamilyCareer,
  getCareerDisplayName,
  initializeFamilyCareer,
  NEUTRAL_FAMILY_ECONOMIC_BACKGROUND,
  isFamilyGuardianRelation,
  type FamilyCareer,
} from "@/lib/family-career";
import { getWorldEra } from "@/lib/world-era";
import { decayToxicity } from "@/lib/quarter-effects";
import { rollEvents } from "@/lib/world-events";

import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { addAttrExp, type AttrExpMap } from "@/lib/location-events";
import { json } from "@/lib/json-helper";

async function handler(request: NextRequest) {
  // ── 鉴权 ──────────────────────────────────────────────
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;

  const cultivator = auth.cultivator;

  // ── 仅接受客户端传入的提示字段 ──
  const body = await parseJsonBody(request).catch(() => ({}) as Record<string, unknown>);

  // ── 服务端权威状态 ──────────────────────────────────
  // 属性、职业、schoolRank 均从数据库读取，不信任客户端
  const savedAttrs = sanitizeAttributes(cultivator.attributes) || {};
  const currentOccupation = cultivator.occupation || getDefaultOccupation(cultivator.age);

  // schoolRank: DB 存储 Int(0/1/2)，转换为业务类型
  const currentDbRank = typeof cultivator.schoolRank === "number" ? cultivator.schoolRank : 0;
  const currentSchoolRank: SchoolRank = dbToSchoolRank(currentDbRank);

  // ── 季度有效性校验 ──────────────────────────────────
  const currentQuarter = typeof cultivator.quarter === "number" ? cultivator.quarter : 1;
  if (currentQuarter < 1 || currentQuarter > 4) {
    return apiError(`非法季度值: ${currentQuarter}`, 400, "INVALID_QUARTER");
  }

  const nextQuarter = currentQuarter >= 4 ? 1 : currentQuarter + 1;
  const yearWrapped = currentQuarter >= 4;
  const currentWorldYear = cultivator.worldYear;
  const nextWorldYear = yearWrapped ? currentWorldYear + 1 : currentWorldYear;

  // ── 季度的固定副作用：体力回满 + 丹毒衰减 + 健康恢复 ──
  const maxStamina = calculateMaxStamina(cultivator.age, savedAttrs);
  const quarterStamina = maxStamina;

  const newToxicity = decayToxicity(cultivator.toxicity || 0);

  // 健康恢复（每季度 +1，上限 100；健康 ≤0 时不恢复）
  const healthRecovery = calcQuarterlyHealthRecovery(cultivator.health ?? 100);
  // 健康 ≤0 时施加 injuryDebuff
  const zeroDebuff = checkHealthZero(healthRecovery.newHealth);

  // ── 跨年逻辑（仅在 4→1 时触发） ────────────────────
  let oldAge = cultivator.age;
  let newAge = cultivator.age;
  let awakenEvent: { title: string; narrative: string; bonuses?: Record<string, string> } | null =
    null;
  let newRealm = cultivator.realm;
  let newRealmLevel = cultivator.realmLevel;
  let schoolRank: SchoolRank = currentSchoolRank;
  let schoolStage: SchoolStage | null = null;
  let examResult: { passed: boolean; rank: string; description: string } | null = null;
  let occupation = currentOccupation;
  let warnEarly = false;
  let remaining = 0;
  let maxAge = cultivator.maxAge || 0;
  let newAttributes = savedAttrs;
  let nextAttrExp: AttrExpMap | null = null;
  let npcRelations: Record<string, NpcRelationData> = {};
  let cliqueKey: CliqueKey | null = null;
  let currentSavings: number | undefined;
  let pocketMoneyResult: { granted: number; interest: number } | null = null;
  let classBenefitsResult: { optionCount: number; totalCost: number } | null = null;
  let classGoldDeduction = 0;
  let annualAllowance: number | undefined;
  let householdIncome: ReturnType<typeof calculateHouseholdIncome> | undefined;
  let evolvedFamilyMembers: Array<{ id: string; career: FamilyCareer; occupation: string }> = [];
  let familyCareerChanges: Array<{
    relation: string;
    name: string;
    previousStatus: string;
    status: string;
    previousLevel: number;
    level: number;
    occupation: string;
  }> = [];

  if (yearWrapped) {
    oldAge = cultivator.age;
    newAge = oldAge + 1;

    // ── 寿元检查 ──────────────────────────────────────
    maxAge = calculateMaxAge(cultivator.realm, savedAttrs, cultivator.bonusAge || 0);
    if (newAge > maxAge) {
      return NextResponse.json({
        daoXiao: true,
        summary: {
          age: cultivator.age,
          realm: cultivator.realm,
          realmLevel: cultivator.realmLevel,
          breakthroughCount: cultivator.breakthroughCount,
          reincarnationCount: cultivator.reincarnationCount || 0,
          totalExp: cultivator.totalExp,
        },
      });
    }

    remaining = maxAge - newAge;
    warnEarly = remaining <= 10 || remaining < maxAge * 0.1;
    // 跨年属性成长：改为经验通道，不再直加 attributes
    const growthExp = calculateYearlyAttributeGrowth(oldAge, newAge, savedAttrs, currentSchoolRank);
    nextAttrExp = addAttrExp(json.attributeExp(cultivator.attributeExp) || {}, growthExp);

    // ── NPC 关系（同学 + 师长） ──────────────────────
    try {
      const raw = cultivator.npcRelations;
      npcRelations = typeof raw === "string" && raw ? JSON.parse(raw) : {};
    } catch {
      /* 解析失败保持空对象 */
    }

    // 同学生成（6-15 岁，仅一次）
    if (cultivator.worldId === "earth") {
      npcRelations = generateClassmates(newAge, npcRelations);
    }

    // 师长生成（6 岁入学时，仅一次）
    if (cultivator.worldId === "earth") {
      npcRelations = generateTeachers(newAge, npcRelations);
    }

    // 师长好感对学校档位的加权
    const teacherBonus = getTeacherRankBonus(npcRelations);

    // ── 小团体派系（6-15 岁，每年重新判定） ──────────
    if (newAge >= 6 && newAge < 16) {
      cliqueKey = decideClique(
        { insight: newAttributes.insight || 0, root: newAttributes.root || 0 },
        newAge
      );
    }
    const cliqueBonus = getCliqueBonus(cliqueKey);
    // 将派系加成叠加到属性
    for (const [key, val] of Object.entries(cliqueBonus)) {
      if (newAttributes[key] !== undefined) {
        newAttributes[key] = Math.round((newAttributes[key] + val) * 10) / 10;
      }
    }

    // ── 课外班年度属性加成与扣费 ──────────────────────
    classBenefitsResult = null;
    classGoldDeduction = 0;
    if (newAge >= 6 && newAge <= 18) {
      const records = parseClassEnroll(cultivator.classEnroll);
      if (records.length > 0) {
        const { attributes: classAttrs, totalCost } = applyClassBenefits(records, newAttributes);
        newAttributes = classAttrs;
        classBenefitsResult = { optionCount: records.length, totalCost };
        classGoldDeduction = Math.min(totalCost, cultivator.gold ?? 0);
      }
    }

    // ── 升学（含师长加权） ──────────────────────────
    schoolStage = getSchoolStage(newAge);
    if ([6, 12, 15, 18].includes(newAge) && schoolStage) {
      schoolRank = calculateSchoolRank(newAge, newAttributes, teacherBonus);
      examResult = {
        passed: true,
        rank: schoolRank,
        description: `参加${schoolStage.name}升学考试，考入${getSchoolName(schoolStage, schoolRank)}`,
      };
    }

    // ── 家庭职业与统一经济：跨年只计算一次，稍后与乐观锁在同一事务持久化 ──
    if (cultivator.worldId === "earth") {
      try {
        const familyMembers = await prisma.familyMember.findMany({
          where: { cultivatorId: cultivator.id, alive: true },
          select: {
            id: true,
            relation: true,
            name: true,
            age: true,
            alive: true,
            intimacy: true,
            occupation: true,
            incomeLevel: true,
            careerCategory: true,
            careerLevel: true,
            careerStatus: true,
            monthlyIncome: true,
            careerUpdatedYear: true,
          },
        });
        evolvedFamilyMembers = familyMembers.map((member) => {
          // 旧存档的空值或非法类别以成员稳定 ID、旧职业文本和年份确定性归一化。
          const initial = initializeFamilyCareer({
            relation: member.relation,
            age: member.age,
            alive: member.alive,
            worldYear: currentWorldYear,
            familyBackground: NEUTRAL_FAMILY_ECONOMIC_BACKGROUND,
            categoryHint: member.careerCategory ?? member.occupation ?? undefined,
            levelHint: member.careerLevel,
          });
          const validStatus = ["employed", "unemployed", "retired"].includes(member.careerStatus);
          const validExisting = Boolean(
            member.careerCategory && initial.careerCategory === member.careerCategory && validStatus
          );
          const needsNormalization = !validExisting || member.careerUpdatedYear === null;
          const previous: FamilyCareer = validExisting
            ? {
                relation: member.relation,
                age: member.age,
                alive: member.alive,
                careerCategory: initial.careerCategory,
                careerLevel: member.careerLevel,
                careerStatus: member.careerStatus as FamilyCareer["careerStatus"],
                monthlyIncome: Math.max(0, member.monthlyIncome),
                incomeLevel: member.incomeLevel ?? 0,
                careerUpdatedYear: member.careerUpdatedYear,
              }
            : initial;
          const career = evolveFamilyCareer({
            career: previous,
            memberAge: Math.min(member.age + 1, 120),
            worldYear: nextWorldYear,
            seed: `${cultivator.id}|${member.id}|${nextWorldYear}`,
          });
          const occupation = getCareerDisplayName(
            career.careerCategory,
            career.careerLevel,
            nextWorldYear
          );
          if (
            previous.careerStatus !== career.careerStatus ||
            previous.careerLevel !== career.careerLevel ||
            needsNormalization
          ) {
            familyCareerChanges.push({
              relation: member.relation,
              name: member.name,
              previousStatus: previous.careerStatus,
              status: career.careerStatus,
              previousLevel: previous.careerLevel,
              level: career.careerLevel,
              occupation,
            });
          }
          return { id: member.id, career, occupation };
        });
        householdIncome = calculateHouseholdIncome(
          evolvedFamilyMembers.map((member) => member.career)
        );
        const parents: AllowanceParent[] = evolvedFamilyMembers
          .map((evolved, idx) => ({
            intimacy: familyMembers[idx]?.intimacy ?? 0,
            incomeLevel: evolved.career.incomeLevel,
          }))
          .filter((_, idx) => isFamilyGuardianRelation(familyMembers[idx]?.relation ?? ""));
        annualAllowance = calculateAnnualFamilyAllowance(newAge, parents, householdIncome);

        if (schoolStage && schoolStage.name !== "幼儿园") {
          const parentsForSavings: ParentLike[] = evolvedFamilyMembers
            .map((evolved, idx) => ({
              intimacy: familyMembers[idx]?.intimacy ?? 0,
              incomeLevel: evolved.career.incomeLevel,
            }))
            .filter((_, idx) => isFamilyGuardianRelation(familyMembers[idx]?.relation ?? ""));
          const pm = calcPocketMoney(schoolStage.name, parentsForSavings, householdIncome);
          const interest = calcSavingsInterest(cultivator.savings ?? 0);
          if (pm.granted > 0 || interest > 0) {
            currentSavings = (cultivator.savings ?? 0) + pm.granted + interest;
            pocketMoneyResult = { granted: pm.granted, interest };
          }
        }
      } catch (error) {
        logger.error("跨年家庭职业结算失败", { cultivatorId: cultivator.id, error });
        return apiError("家庭职业结算失败，请稍后重试", 500, "FAMILY_CAREER_SETTLEMENT_FAILED");
      }
    }

    // ── 职业自动切换 ──────────────────────────────────
    const defaultOcc = getDefaultOccupation(newAge);
    if (defaultOcc !== getDefaultOccupation(oldAge)) occupation = defaultOcc;

    // ── 地球世界观：16 岁灵气觉醒 ────────────────────
    if (
      cultivator.worldId === "earth" &&
      cultivator.realm === "凡人" &&
      oldAge < 16 &&
      newAge >= 16
    ) {
      newRealm = "炼气期";
      newRealmLevel = 1;
      const attr = newAttributes;
      const rootBonus = Math.floor((attr.root || 0) * 2);
      const spiritBonus = Math.floor((attr.spirit || 0) * 3);
      const insightBonus = Math.floor((attr.insight || 0) * 2);
      const luckBonus = Math.floor((attr.luck || 0) * 1.5);
      const charmBonus = Math.floor((attr.charm || 0) * 2);
      const mindBonus = Math.floor((attr.mind || 0) * 2);
      const bonuses = {
        rootBonus: String(rootBonus),
        spiritBonus: String(spiritBonus),
        insightBonus: String(insightBonus),
        luckBonus: String(luckBonus),
        charmBonus: String(charmBonus),
        mindBonus: String(mindBonus),
      };
      awakenEvent = {
        title: "灵气觉醒",
        narrative: `${cultivator.name}迎来了十六岁生日。灵气开始复苏！\n\n根骨${attr.root || 0}→体力+${rootBonus}\n灵性${attr.spirit || 0}→修炼速度+${spiritBonus}%\n悟性${attr.insight || 0}→突破概率+${insightBonus}%\n气运${attr.luck || 0}→奇遇率+${luckBonus}%\n魅力${attr.charm || 0}→初始好感+${charmBonus}\n心性${attr.mind || 0}→心魔抗性+${mindBonus}%`,
        bonuses,
      };
    }
  }

  // ── 拼装更新数据 ────────────────────────────────────
  const updateData: Prisma.CultivatorUpdateInput = {
    quarter: nextQuarter,
    stamina: quarterStamina,
    toxicity: newToxicity,
    health: healthRecovery.newHealth,
  };

  // 健康 ≤0 时施加 injuryDebuff
  if (zeroDebuff > 0) {
    updateData.injuryDebuff = (cultivator.injuryDebuff || 0) + zeroDebuff;
  }

  if (yearWrapped) {
    updateData.age = newAge;
    updateData.worldYear = nextWorldYear;
    updateData.stamina = calculateMaxStamina(newAge, newAttributes);
    updateData.maxAge = maxAge;
    // 重伤 debuff 按年递减
    if ((cultivator.injuryDebuff || 0) > 0) {
      updateData.injuryDebuff = Math.max(0, (cultivator.injuryDebuff || 0) - 1);
    }
    // 属性每年增长后持久化
    updateData.attributes = JSON.stringify(newAttributes);
    // 年龄成长改走经验通道
    if (nextAttrExp) updateData.attributeExp = JSON.stringify(nextAttrExp);
    // 职业变化持久化
    updateData.occupation = occupation;
    // schoolRank 持久化（Int 类型）
    updateData.schoolRank = schoolRankToDb(schoolRank);
    // NPC 关系持久化
    if (cultivator.worldId === "earth") {
      updateData.npcRelations = JSON.stringify(npcRelations);
    }
    // 小团体派系持久化
    if (cliqueKey) {
      updateData.clique = cliqueKey;
    }
    // 课外班扣费
    if (classGoldDeduction > 0) {
      updateData.gold = (cultivator.gold ?? 0) - classGoldDeduction;
    }
    // 年度家人零花钱额度持久化
    if (annualAllowance !== undefined) {
      updateData.allowanceYear = newAge;
      updateData.allowanceRemaining = annualAllowance;
    }
    // 零花钱 + 储蓄利息持久化
    if (currentSavings !== undefined) {
      updateData.savings = currentSavings;
    }
    // 觉醒时的境界变化
    if (newRealm !== cultivator.realm) {
      updateData.realm = newRealm;
      updateData.realmLevel = newRealmLevel;
    }
  }

  // 即使非跨年，觉醒也可能改变境界（当前逻辑仅在跨年触发，此处保留原语义）
  if (!yearWrapped && newRealm !== cultivator.realm) {
    updateData.realm = newRealm;
    updateData.realmLevel = newRealmLevel;
  }

  // ── 世界事件检测（每季度触发） ─────────────────────
  const stage = cultivator.realm === "凡人" && cultivator.realmLevel === 0 ? "凡人" as const : "觉醒" as const;
  const activeWorldEvents = await prisma.worldEvent.findMany({
    where: { cultivatorId: cultivator.id, resolved: false },
    select: { eventId: true },
  });
  const activeEventIds = activeWorldEvents.map((e) => e.eventId);
  const newEvents = rollEvents(stage, activeEventIds, currentWorldYear);
  for (const evt of newEvents) {
    await prisma.worldEvent.create({
      data: {
        cultivatorId: cultivator.id,
        eventId: evt.id,
        title: evt.title,
        description: evt.description,
        stage: evt.stage,
        duration: evt.duration,
        effect: evt.effect ? JSON.stringify(evt.effect) : null,
      },
    });
  }

  // 推进活跃事件：elapsed +1，到期则 resolved
  const expiredEvents = await prisma.worldEvent.findMany({
    where: { cultivatorId: cultivator.id, resolved: false },
  });
  for (const evt of expiredEvents) {
    const newElapsed = (evt.elapsed ?? 0) + 1;
    await prisma.worldEvent.update({
      where: { id: evt.id },
      data: { elapsed: newElapsed, resolved: newElapsed >= evt.duration },
    });
  }

  // ── 乐观锁与跨年职业持久化：在同一事务中执行 ────────
  // 先抢占 id + quarter + age，失败时绝不写入家人职业，确保并发跨年只结算一次。
  let transactionResult;
  try {
    transactionResult = await prisma.$transaction(async (tx) => {
      const updatedCultivator = await tx.cultivator.updateMany({
        where: {
          id: cultivator.id,
          quarter: currentQuarter,
          age: cultivator.age,
        },
        data: updateData,
      });
      if (updatedCultivator.count === 0) return null;

      for (const member of evolvedFamilyMembers) {
        await tx.familyMember.update({
          where: { id: member.id },
          data: {
            age: member.career.age,
            occupation: member.occupation,
            incomeLevel: member.career.incomeLevel,
            careerCategory: member.career.careerCategory,
            careerLevel: member.career.careerLevel,
            careerStatus: member.career.careerStatus,
            monthlyIncome: member.career.monthlyIncome,
            careerUpdatedYear: member.career.careerUpdatedYear,
          },
        });
      }
      return tx.cultivator.findUnique({ where: { id: cultivator.id } });
    });
  } catch (error) {
    if (yearWrapped && cultivator.worldId === "earth") {
      logger.error("跨年家庭职业结算持久化失败", { cultivatorId: cultivator.id, error });
      return apiError("家庭职业结算失败，请稍后重试", 500, "FAMILY_CAREER_SETTLEMENT_FAILED");
    }
    throw error;
  }

  if (!transactionResult) {
    return NextResponse.json(
      { error: "状态已变化，已刷新最新进度", code: "SEASON_CONFLICT" },
      { status: 409 }
    );
  }

  // ── 读取事务提交后的最新记录 ─────────────────────────
  const freshCultivator = transactionResult;
  if (!freshCultivator) {
    return apiError("修炼者不存在", 404, "NO_CULTIVATOR");
  }

  const canBreak = canBreakthrough(
    freshCultivator.realm,
    freshCultivator.realmLevel,
    freshCultivator.cultivationExp,
    freshCultivator.spiritualRoot,
    freshCultivator.breakthroughBuff || 0
  );

  return NextResponse.json({
    cultivator: freshCultivator,
    quarter: nextQuarter,
    yearWrapped,
    worldYear: nextWorldYear,
    era: getWorldEra(nextWorldYear),
    familyCareerChanges,
    oldAge,
    newAge,
    awakenEvent,
    schoolRank,
    schoolStage: schoolStage
      ? { name: schoolStage.name, grade: getSchoolGrade(newAge, schoolStage) }
      : null,
    occupation,
    examResult,
    cliqueInfo: cliqueKey ? getCliqueInfo(cliqueKey) : null,
    pocketMoney: pocketMoneyResult,
    classBenefits: classBenefitsResult,
    healthRecovery: healthRecovery.delta > 0 ? healthRecovery.delta : undefined,
    warnEarly,
    remaining,
    maxAge,
    newAttributes,
    canBreakthrough: canBreak,
  });
}

export const POST = withApiErrorHandling(handler);
