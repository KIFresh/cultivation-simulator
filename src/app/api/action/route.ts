import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionById, calculateActionExp, canBreakthrough, MORTAL_REALM, isAwakened, calculateMaxStamina } from "@/lib";
import { generateActionNarrative } from "@/lib/narrative";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, actionId, freeInput, worldId, family } = body;
    if (!userId || !actionId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });

    const action = getActionById(actionId);
    if (!action) return NextResponse.json({ error: "无效的行动类型" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { cultivator: true } });
    if (!user?.cultivator) return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });

    const cultivator = user.cultivator;
    if (cultivator.stamina < action.actionPointCost) return NextResponse.json({ error: `行动力不足` }, { status: 400 });

    const isEarth = cultivator.worldId === "earth";
    if (isEarth && cultivator.age < action.minAgeEarth) return NextResponse.json({ error: `年龄不足` }, { status: 400 });

    const expGained = calculateActionExp(actionId, cultivator.spiritualRoot, body.attributes);
    let newRealm = cultivator.realm, newRealmLevel = cultivator.realmLevel;
    let newExp = cultivator.cultivationExp + expGained, newTotalExp = cultivator.totalExp + expGained;
    let awakenEvent: { title: string; narrative: string } | null = null;

    if (isEarth && cultivator.realm === MORTAL_REALM && cultivator.age >= 16) {
      newRealm = "炼气期"; newRealmLevel = 1;
      awakenEvent = { title: "灵气觉醒", narrative: `${cultivator.name}终于感知到了天地间的灵气！` };
    }

    const narrativeResult = await generateActionNarrative({
      cultivatorName: cultivator.name, spiritualRoot: cultivator.spiritualRoot,
      realm: newRealm, realmLevel: newRealmLevel, age: cultivator.age,
      worldId: cultivator.worldId || worldId, actionName: action.name,
      actionDescription: action.description, freeInput, expGained,
      isAwakened: isAwakened(newRealm), awakenEvent: !!awakenEvent,
    });

    const [updatedCultivator] = await prisma.$transaction([
      prisma.cultivator.update({ where: { id: cultivator.id }, data: { stamina: { decrement: action.actionPointCost }, cultivationExp: newExp, totalExp: newTotalExp, realm: newRealm, realmLevel: newRealmLevel } as any }),
      prisma.gameEvent.create({ data: { cultivatorId: cultivator.id, type: "ACTION", title: narrativeResult.title, narrative: narrativeResult.narrative, reward: JSON.stringify({ expGained, actionName: action.name, mood: narrativeResult.mood }) } }),
    ]);

    const canBreak = canBreakthrough(newRealm, newRealmLevel, newExp, cultivator.spiritualRoot);

    const capped = { ...updatedCultivator, stamina: Math.min(updatedCultivator.stamina, calculateMaxStamina(updatedCultivator.age)) };
    return NextResponse.json({ narrative: narrativeResult, cultivator: capped, expGained, canBreakthrough: canBreak, awakenEvent });
  } catch (error) {
    console.error("行动执行失败:", error);
    return NextResponse.json({ error: "行动执行失败" }, { status: 500 });
  }
}