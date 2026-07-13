import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNPCDialogue } from "@/lib/narrative";

// POST — NPC 聊天：扣除体力，生成 NPC 回复
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, npcName, npcPersonality, npcRealm, cultivatorName, cultivatorRealm, message, history } = body;

    if (!userId || !npcName || !message) {
      return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { cultivator: true },
    });
    if (!user?.cultivator) {
      return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });
    }

    const c = user.cultivator;
    if (c.stamina < 1) {
      return NextResponse.json({ error: "行动力不足" }, { status: 400 });
    }

    // 扣除体力
    const updated = await prisma.cultivator.update({
      where: { id: c.id },
      data: { stamina: { decrement: 1 } },
    });

    // 生成 NPC 对话
    let dialogue: { dialogue: string; npcMood: string; reward?: { type: string; description: string } };
    try {
      dialogue = await generateNPCDialogue({
        npcName,
        npcPersonality: npcPersonality || "温和",
        npcRealm: npcRealm || "炼气期",
        cultivatorName: cultivatorName || c.name,
        cultivatorRealm: cultivatorRealm || c.realm,
        historySummary: (history || []).map((h: { role: string; content: string }) => `${h.role === "player" ? "玩家" : "NPC"}：${h.content}`).join("\n"),
      });
    } catch {
      dialogue = { dialogue: `${npcName}看了你一眼，微微点头。`, npcMood: "友善" };
    }

    return NextResponse.json({
      cultivator: updated,
      npcDialogue: dialogue.dialogue,
      npcMood: dialogue.npcMood,
      reward: dialogue.reward || null,
    });
  } catch (error) {
    console.error("NPC 聊天失败:", error);
    return NextResponse.json({ error: "对话失败" }, { status: 500 });
  }
}
