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

/** 每季度自然消退的丹毒量（GDD: decayToxicity -3/季） */
export const DETOX_PER_QUARTER = 3;

/** 纯函数：应用丹毒季度衰减，返回新值（最低 0） */
export function decayToxicity(current: number): number {
  return Math.max(0, current - DETOX_PER_QUARTER);
}

export async function POST(request: NextRequest) {
  try {
    // ── 鉴权 ──────────────────────────────────────────────
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;

    const cultivator = auth.cultivator;

    // ── 仅接受客户端传入的提示字段 ──
    await request.json().catch(() => {});

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

    // ── 季度的固定副作用：体力回满 + 丹毒衰减 ────────────
    // 每次成功推进季节，体力直接恢复至当前上限（不增量累积）
    const maxStamina = calculateMaxStamina(cultivator.age, savedAttrs);
    const quarterStamina = maxStamina;

    const newToxicity = decayToxicity(cultivator.toxicity || 0);

    // ── 跨年逻辑（仅在 4→1 时触发） ────────────────────
    let oldAge = cultivator.age;
    let newAge = cultivator.age;
    let awakenEvent: { title: string; narrative: string; bonuses?: Record<string, string> } | null = null;
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
      newAttributes = calculateYearlyAttributeGrowth(oldAge, newAge, savedAttrs, currentSchoolRank);

      // ── 升学 ──────────────────────────────────────────
      schoolStage = getSchoolStage(newAge);
      if ([6, 12, 15, 18].includes(newAge) && schoolStage) {
        schoolRank = calculateSchoolRank(newAge, newAttributes);
        examResult = {
          passed: true,
          rank: schoolRank,
          description: `参加${schoolStage.name}升学考试，考入${getSchoolName(schoolStage, schoolRank)}`,
        };
      }

      // ── 职业自动切换 ──────────────────────────────────
      const defaultOcc = getDefaultOccupation(newAge);
      if (defaultOcc !== getDefaultOccupation(oldAge)) occupation = defaultOcc;

      // ── 地球世界观：16 岁灵气觉醒 ────────────────────
      if (cultivator.worldId === "earth" && cultivator.realm === "凡人" && oldAge < 16 && newAge >= 16) {
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
    };

    if (yearWrapped) {
      updateData.age = newAge;
      updateData.stamina = calculateMaxStamina(newAge, newAttributes);
      updateData.maxAge = maxAge;
      // 重伤 debuff 按年递减
      if ((cultivator.injuryDebuff || 0) > 0) {
        updateData.injuryDebuff = Math.max(0, (cultivator.injuryDebuff || 0) - 1);
      }
      // 属性每年增长后持久化
      updateData.attributes = JSON.stringify(newAttributes);
      // 职业变化持久化
      updateData.occupation = occupation;
      // schoolRank 持久化（Int 类型）
      updateData.schoolRank = schoolRankToDb(schoolRank);
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

    // ── 乐观锁条件更新：防止并发重复推进 ──────────────
    // 以 id + 当前 quarter + 当前 age 作为条件；仅当数据库实际值匹配时才更新
    const updatedCultivator = await prisma.cultivator.updateMany({
      where: {
        id: cultivator.id,
        quarter: currentQuarter,
        age: cultivator.age,
      },
      data: updateData,
    });

    if (updatedCultivator.count === 0) {
      // 并发冲突：记录已变更，返回 409 让前端重新加载
      return NextResponse.json(
        { error: "状态已变化，已刷新最新进度", code: "SEASON_CONFLICT" },
        { status: 409 },
      );
    }

    // ── 重新读取最新记录 ────────────────────────────────
    const freshCultivator = await prisma.cultivator.findUnique({
      where: { id: cultivator.id },
    });
    if (!freshCultivator) {
      return apiError("修炼者不存在", 404, "NO_CULTIVATOR");
    }

    const canBreak = canBreakthrough(
      freshCultivator.realm,
      freshCultivator.realmLevel,
      freshCultivator.cultivationExp,
      freshCultivator.spiritualRoot,
      freshCultivator.breakthroughBuff || 0,
    );

    return NextResponse.json({
      cultivator: freshCultivator,
      quarter: nextQuarter,
      yearWrapped,
      oldAge,
      newAge,
      awakenEvent,
      schoolRank,
      schoolStage: schoolStage
        ? { name: schoolStage.name, grade: getSchoolGrade(newAge, schoolStage) }
        : null,
      occupation,
      examResult,
      warnEarly,
      remaining,
      maxAge,
      newAttributes,
      canBreakthrough: canBreak,
    });
  } catch (error) {
    console.error("季节推进失败:", error);
    return NextResponse.json({ error: "季节推进失败" }, { status: 500 });
  }
}
