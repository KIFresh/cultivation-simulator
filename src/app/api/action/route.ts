import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionById, calculateActionExp, canBreakthrough, MORTAL_REALM, isAwakened, calculateMaxStamina } from "@/lib";
import { generateActionNarrative, type StoryEntry, createEntry, buildSummaryFromEntries, compressStorySummary } from "@/lib/narrative";
import { sanitizeAttributes } from "@/lib/utils";


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, actionId, freeInput, worldId } = body;
    if (!userId || !actionId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });

    const action = getActionById(actionId);
    if (!action) return NextResponse.json({ error: "无效的行动类型" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { cultivator: true } });
    if (!user?.cultivator) return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });

    const cultivator = user.cultivator;
    if (cultivator.stamina < action.actionPointCost) return NextResponse.json({ error: `行动力不足` }, { status: 400 });

    const isEarth = cultivator.worldId === "earth";
    if (isEarth && cultivator.age < action.minAgeEarth) return NextResponse.json({ error: `年龄不足` }, { status: 400 });

    const safeAttrs = sanitizeAttributes(body.attributes) || {};
    const expGained = calculateActionExp(actionId, cultivator.spiritualRoot, safeAttrs, JSON.parse(cultivator.talents || '[]'), cultivator.reincarnationCount || 0);
    let newRealm = cultivator.realm, newRealmLevel = cultivator.realmLevel;
    let newExp = cultivator.cultivationExp + expGained, newTotalExp = cultivator.totalExp + expGained;
    let awakenEvent: { title: string; narrative: string } | null = null;

    if (isEarth && cultivator.realm === MORTAL_REALM && cultivator.age >= 16) {
      newRealm = "炼气期"; newRealmLevel = 1;
      awakenEvent = { title: "灵气觉醒", narrative: `${cultivator.name}终于感知到了天地间的灵气！` };
    }

    const currentEntries: StoryEntry[] = JSON.parse(cultivator.storyEntries || '[]');
    const summaryText = buildSummaryFromEntries(currentEntries);

    const narrativeResult = await generateActionNarrative({
      cultivatorName: cultivator.name, spiritualRoot: cultivator.spiritualRoot,
      realm: newRealm, realmLevel: newRealmLevel, age: cultivator.age,
      worldId: cultivator.worldId || worldId, actionName: action.name,
      actionDescription: action.description, freeInput, expGained,
      isAwakened: isAwakened(newRealm), awakenEvent: !!awakenEvent,
      storySummary: summaryText || undefined,
    });

    // 创建新条目 + 追加 + 压缩
    const newEntry = createEntry(narrativeResult.title, narrativeResult.narrative);
    let updatedEntries = [...currentEntries, newEntry];
    const newSummary = buildSummaryFromEntries(updatedEntries);
    if (updatedEntries.length > 50 || newSummary.length > 1000) {
      const compressed = await compressStorySummary(updatedEntries, cultivator.name);
      const ce = createEntry("📜 记忆凝练", compressed, false);
      updatedEntries = [...updatedEntries.filter(e => e.important), ce];
    }

    // 构建事务操作
    const txOps: any[] = [
      prisma.cultivator.update({ where: { id: cultivator.id }, data: { stamina: { decrement: action.actionPointCost }, cultivationExp: newExp, totalExp: newTotalExp, realm: newRealm, realmLevel: newRealmLevel, storyEntries: JSON.stringify(updatedEntries), storyEntriesUpdatedAt: new Date() } }),
      prisma.gameEvent.create({ data: { cultivatorId: cultivator.id, type: "ACTION", title: narrativeResult.title, narrative: narrativeResult.narrative, reward: JSON.stringify({ expGained, actionName: action.name, mood: narrativeResult.mood }) } }),
    ];

    // 如果有觉醒事件，也持久化
    if (awakenEvent) {
      txOps.push(prisma.gameEvent.create({
        data: { cultivatorId: cultivator.id, type: "AWAKENING", title: awakenEvent.title, narrative: awakenEvent.narrative, reward: JSON.stringify({ mood: "奇" }) },
      }));
    }

    const [updatedCultivator] = await prisma.$transaction(txOps);

    const canBreak = canBreakthrough(newRealm, newRealmLevel, newExp, cultivator.spiritualRoot);

    const capped = { ...updatedCultivator, stamina: Math.min(updatedCultivator.stamina, calculateMaxStamina(updatedCultivator.age, safeAttrs)) };
    return NextResponse.json({ narrative: narrativeResult, cultivator: capped, expGained, canBreakthrough: canBreak, awakenEvent });
  } catch (error) {
    console.error("行动执行失败:", error);
    return NextResponse.json({ error: "行动执行失败" }, { status: 500 });
  }
}