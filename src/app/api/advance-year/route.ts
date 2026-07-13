import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateYearAdvanceNarrative, appendToSummary, shouldCompress, compressStorySummary } from "@/lib/narrative";
import { Prisma } from "@/generated/prisma/client";
import { sanitizeAttributes } from "@/lib/utils";
import { getSchoolStage, getSchoolGrade, calculateSchoolRank, getSchoolName, getDefaultOccupation, parseOccupationFromNarrative, calculateYearlyAttributeGrowth, calculateMaxStamina, type SchoolRank } from "@/lib";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, worldId, attributes: rawAttributes, schoolRank: currentRank, occupation: currentOcc } = body;
    if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { cultivator: true } });
    if (!user?.cultivator) return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });

    const cultivator = user.cultivator;
    const oldAge = cultivator.age, newAge = oldAge + 1;

    const currentAttrs: Record<string, number> = sanitizeAttributes(rawAttributes) || {};
    const currentRankVal = currentRank || "普通";
    const newAttributes = calculateYearlyAttributeGrowth(oldAge, newAge, currentAttrs, currentRankVal as SchoolRank);

    const schoolStage = getSchoolStage(newAge);
    let schoolRank = currentRankVal;
    let examResult: { passed: boolean; rank: string; description: string } | null = null;

    if ([6, 12, 15, 18].includes(newAge) && schoolStage) {
      schoolRank = calculateSchoolRank(newAge, newAttributes);
      examResult = { passed: true, rank: schoolRank, description: `参加${schoolStage.name}升学考试，考入${getSchoolName(schoolStage, schoolRank)}` };
    }

    let occupation = currentOcc || getDefaultOccupation(oldAge);
    const defaultOcc = getDefaultOccupation(newAge);
    if (defaultOcc !== getDefaultOccupation(oldAge)) occupation = defaultOcc;

    const schoolContext = schoolStage ? `${newAge}岁，${schoolStage.name}${getSchoolGrade(newAge, schoolStage)}年级` : `${newAge}岁`;
    const examContext = examResult ? `\n【升学考试】${examResult.description}` : "";

    const currentSummary = cultivator.storySummary;
    const narrativeResult = await generateYearAdvanceNarrative({
      cultivatorName: cultivator.name, spiritualRoot: cultivator.spiritualRoot,
      realm: cultivator.realm, realmLevel: cultivator.realmLevel,
      oldAge, newAge, totalExp: cultivator.totalExp,
      worldId: cultivator.worldId || worldId,
      extraContext: `${schoolContext}${examContext}\n职业：${occupation}`,
      storySummary: currentSummary || undefined,
    });

    // 追加概要，超长则压缩
    const newSummary = appendToSummary(currentSummary, { title: narrativeResult.title, narrative: narrativeResult.narrative });
    let finalSummary = newSummary;
    if (shouldCompress(newSummary)) {
      finalSummary = await compressStorySummary(newSummary, cultivator.name);
    }

    let awakenEvent: { title: string; narrative: string; bonuses?: Record<string, string> } | null = null;
    let newRealm = cultivator.realm, newRealmLevel = cultivator.realmLevel;
    if (cultivator.worldId === "earth" && cultivator.realm === "凡人" && cultivator.age < 16 && newAge >= 16) {
      newRealm = "炼气期"; newRealmLevel = 1;
      // 属性转换：六项属性影响修仙初始值
      const attr = newAttributes;
      const rootBonus = Math.floor((attr.root || 0) * 2);       // 根骨→体力上限
      const spiritBonus = Math.floor((attr.spirit || 0) * 3);   // 灵性→修炼速度
      const insightBonus = Math.floor((attr.insight || 0) * 2); // 悟性→突破概率
      const luckBonus = Math.floor((attr.luck || 0) * 1.5);     // 气运→奇遇率
      const charmBonus = Math.floor((attr.charm || 0) * 2);     // 魅力→初始好感
      const mindBonus = Math.floor((attr.mind || 0) * 2);       // 心性→心魔抗性
      const bonuses = { rootBonus: String(rootBonus), spiritBonus: String(spiritBonus), insightBonus: String(insightBonus), luckBonus: String(luckBonus), charmBonus: String(charmBonus), mindBonus: String(mindBonus) };
      awakenEvent = {
        title: "灵气觉醒",
        narrative: `${cultivator.name}迎来了十六岁生日。灵气开始复苏！\n\n根骨${attr.root||0}→体力+${rootBonus}\n灵性${attr.spirit||0}→修炼速度+${spiritBonus}%\n悟性${attr.insight||0}→突破概率+${insightBonus}%\n气运${attr.luck||0}→奇遇率+${luckBonus}%\n魅力${attr.charm||0}→初始好感+${charmBonus}\n心性${attr.mind||0}→心魔抗性+${mindBonus}%`,
        bonuses,
      };
    }

    const narrativeOcc = parseOccupationFromNarrative(narrativeResult.narrative, occupation);
    if (narrativeOcc) occupation = narrativeOcc;

    const updateData: Prisma.CultivatorUpdateInput = { age: newAge, stamina: calculateMaxStamina(newAge, newAttributes), storySummary: finalSummary, storySummaryUpdatedAt: new Date() };
    if (newRealm !== cultivator.realm) { updateData.realm = newRealm; updateData.realmLevel = newRealmLevel; }

    const [updatedCultivator] = await prisma.$transaction([
      prisma.cultivator.update({ where: { id: cultivator.id }, data: updateData }),
      prisma.gameEvent.create({ data: { cultivatorId: cultivator.id, type: "YEAR_ADVANCE", title: awakenEvent ? awakenEvent.title : narrativeResult.title, narrative: awakenEvent ? awakenEvent.narrative : narrativeResult.narrative, reward: JSON.stringify({ oldAge, newAge, mood: narrativeResult.mood, schoolRank, occupation }) } }),
    ]);

    return NextResponse.json({ narrative: narrativeResult, cultivator: updatedCultivator, awakenEvent, oldAge, newAge, newAttributes, schoolRank, schoolStage: schoolStage ? { name: schoolStage.name, grade: getSchoolGrade(newAge, schoolStage) } : null, occupation, examResult });
  } catch (error) {
    console.error("时间推进失败:", error);
    return NextResponse.json({ error: "时间推进失败" }, { status: 500 });
  }
}