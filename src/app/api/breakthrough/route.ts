import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import {
  generateBreakthroughNarrative,
  type StoryEntry,
  createEntry,
  buildSummaryFromEntries,
  compressStorySummary,
  stateFromCultivator,
} from "@/lib/narrative";
import { canBreakthrough, performBreakthrough } from "@/lib";
import { Prisma } from "@/generated/prisma/client";
import { streamNarrativeResult } from "@/lib/narrative-stream";

const PROTECTOR_EFFECTS: Record<string, { failReduce: number; mindReduce: number }> = {
  sanxiu: { failReduce: 15, mindReduce: 30 },
  zhanglao: { failReduce: 35, mindReduce: 60 },
  duijie: { failReduce: 60, mindReduce: 90 },
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const { protector } = body;
    const isStream = new URL(request.url).searchParams.get("stream") === "true";

    if (cultivator.realm === "凡人") {
      return NextResponse.json({ error: "凡人无法突破，需先灵气觉醒" }, { status: 400 });
    }

    const buff = cultivator.breakthroughBuff || 0;
    if (!canBreakthrough(cultivator.realm, cultivator.realmLevel, cultivator.cultivationExp, cultivator.spiritualRoot, buff)) {
      return NextResponse.json({ error: "尚未满足突破条件" }, { status: 400 });
    }

    const next = performBreakthrough(cultivator.realm, cultivator.realmLevel, cultivator.cultivationExp, buff);
    if (!next) return NextResponse.json({ error: "无法突破" }, { status: 400 });

    // 护道降低心魔波动
    const prot = protector ? PROTECTOR_EFFECTS[protector] : undefined;
    const newMindDemon = Math.max(0, (cultivator.mindDemon || 0) - (prot ? prot.mindReduce : 0) + (prot ? 0 : 5));

    const currentEntries: StoryEntry[] = JSON.parse(cultivator.storyEntries || "[]");
    const summaryText = buildSummaryFromEntries(currentEntries);
    const narrativeResult = await generateBreakthroughNarrative({
      cultivatorName: cultivator.name,
      spiritualRoot: cultivator.spiritualRoot as any,
      fromRealm: cultivator.realm,
      fromLevel: cultivator.realmLevel,
      toRealm: next.newRealm,
      toLevel: next.newLevel,
      totalExp: cultivator.totalExp,
      breakthroughCount: cultivator.breakthroughCount,

      state: { ...stateFromCultivator(cultivator), realm: next.newRealm, realmLevel: next.newLevel },
    });

    const newEntry = createEntry(narrativeResult.title, narrativeResult.narrative, true, narrativeResult.summary);
    let updatedEntries = [...currentEntries, newEntry];
    const newSummary = buildSummaryFromEntries(updatedEntries);
    if (updatedEntries.length > 50 || newSummary.length > 1000) {
      const compressed = await compressStorySummary(updatedEntries, cultivator.name);
      const ce = createEntry("📜 记忆凝练", compressed, false);
      updatedEntries = [...updatedEntries.filter((e) => e.important), ce];
    }

    const updateData: Prisma.CultivatorUpdateInput = {
      realm: next.newRealm,
      realmLevel: next.newLevel,
      cultivationExp: next.newExp,
      totalExp: cultivator.totalExp,
      breakthroughCount: cultivator.breakthroughCount + 1,
      mindDemon: newMindDemon,
      breakthroughBuff: 0,
      storyEntries: JSON.stringify(updatedEntries),
      storyEntriesUpdatedAt: new Date(),
    };

    const breakthroughEvent = await prisma.gameEvent.create({
      data: {
        cultivatorId: cultivator.id,
        type: "BREAKTHROUGH",
        title: narrativeResult.title,
        narrative: narrativeResult.narrative,
        reward: JSON.stringify({ fromRealm: cultivator.realm, toRealm: next.newRealm, protector: protector || null }),
      },
    });

    const [updatedCultivator] = await prisma.$transaction([
      prisma.cultivator.update({ where: { id: cultivator.id }, data: updateData }),
    ]);

    const canBreak = canBreakthrough(
      updatedCultivator.realm,
      updatedCultivator.realmLevel,
      updatedCultivator.cultivationExp,
      updatedCultivator.spiritualRoot,
      0,
    );

    const breakthroughResult = {
      success: true,
      narrative: narrativeResult,
      cultivator: updatedCultivator,
      canBreakthrough: canBreak,
    };
    if (isStream) {
      return streamNarrativeResult(breakthroughEvent.id, narrativeResult, breakthroughResult, updatedCultivator);
    }
    return NextResponse.json(breakthroughResult);
  } catch (error) {
    console.error("突破失败:", error);
    return NextResponse.json({ error: "突破失败" }, { status: 500 });
  }
}
