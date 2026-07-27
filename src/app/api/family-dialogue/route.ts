import { NextRequest, NextResponse } from "next/server";
import { generateFamilyDialogue, buildSummaryFromEntries, stateFromCultivator } from "@/lib/narrative";
import { streamNarrativeResult } from "@/lib/narrative-stream";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { json } from "@/lib/json-helper";
import { logger } from "@/lib/logger";
import { applyEffects, clampEffectsArray, type NarrativeEffect, type ApplyContext } from "@/lib/narrative-effects";
import { getGoldMaxGainByRealm } from "@/lib/gold";
import { sanitizeAttributes } from "@/lib/utils";
import { calculateMaxStamina } from "@/lib/cultivation-data";
function hasPhone(inventoryRaw: string | null): boolean {
  if (!inventoryRaw) return false;
  try {
    const inv: { itemId: string }[] = json.inventory(inventoryRaw);
    return inv.some((i) => i.itemId === "phone");
  } catch { return false; }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { familyMemberName, familyMemberRelation, playerMessage } = body;
    const isStream = new URL(request.url).searchParams.get("stream") === "true";

    if (!familyMemberName || !playerMessage) {
      return apiError("缺少必填参数");
    }

    // playerMessage 长度校验
    if (playerMessage.length > 500) {
      return apiError("消息过长（最多500字）");
    }

    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator;

    // 婴儿不能说话
    const CAN_SPEAK_AGE = 3;
    if (c.age < CAN_SPEAK_AGE) {
      return NextResponse.json({ error: "宝宝还不会说话，咿咿呀呀地比划着……" }, { status: 400 });
    }

    // 从 DB 读取家庭成员
    const familyMember = await prisma.familyMember.findFirst({
      where: { cultivatorId: c.id, relation: familyMemberRelation || "父亲", name: familyMemberName, alive: true }});
    if (!familyMember) {
      return NextResponse.json({ error: "未找到该家庭成员" }, { status: 404 });
    }

    // 家庭成员在当前地点（默认 home）或玩家有手机
    const isSameLocation = true; // 家人默认在家，玩家也常在 home
    const hasPhoneItem = hasPhone(c.inventory);
    const apCost = isSameLocation || hasPhoneItem ? 1 : 2;
    if (c.stamina < apCost) {
      return NextResponse.json({ error: `行动力不足（需要${apCost}点）` }, { status: 400 });
    }

    // 构建剧情概要
    let storySummary: string | undefined;
    try {
      const entries = json.storyEntries(c.storyEntries);
      storySummary = buildSummaryFromEntries(Array.isArray(entries) ? entries : []);
    } catch (e) { logger.error("[family-dialogue/route.ts] 解析剧情记录失败:", e); }

    const result = await generateFamilyDialogue({
      familyMemberName: familyMember.name,
      familyMemberRelation: familyMember.relation,
      familyMemberAge: familyMember.age,
      intimacy: familyMember.intimacy,
      cultivatorName: c.name,
      cultivatorAge: c.age,
      cultivatorRealm: c.realm,
      cultivatorRealmLevel: c.realmLevel,
      playerMessage,
      dialogueHistory: json.dialogueHistory(familyMember.dialogueHistory) as any,
      worldId: c.worldId || "earth",
      storySummary,
      state: stateFromCultivator(c),
    });

    // AI 调用成功后，在事务中统一通过 effects 契约处理
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 事务内读取最新快照，避免并发过期
      const freshC = await tx.cultivator.findUnique({ where: { id: c.id } });
      if (!freshC) throw new Error("修炼者不存在");

      // 构建效果数组（原始值，钳制层会统一处理）
      const effects: NarrativeEffect[] = [
        { kind: "stamina", delta: -apCost },
      ];
      if (result.intimacyDelta) {
        effects.push({ kind: "intimacy", targetRelation: familyMember.relation, delta: result.intimacyDelta });
      }
      if (result.goldChange) {
        effects.push({ kind: "gold", delta: result.goldChange });
      }

      // 按境界动态设置金币上限，一次钳制全量效果
      const maxGoldCap = getGoldMaxGainByRealm(freshC.realmLevel ?? 0);
      const clamped = clampEffectsArray(effects, {
        currentGold: freshC.gold ?? 0,
        currentStamina: freshC.stamina,
        maxStamina: calculateMaxStamina(freshC.age, sanitizeAttributes(freshC.attributes) ?? undefined),
        maxGoldAbsDelta: maxGoldCap,
      });
      const ctx: ApplyContext = {
        cultivatorId: c.id,
        currentGold: freshC.gold ?? 0,
        currentStamina: freshC.stamina,
        maxStamina: calculateMaxStamina(freshC.age, sanitizeAttributes(freshC.attributes) ?? undefined),
        familyMembers: [{ relation: familyMember.relation, id: familyMember.id, intimacy: familyMember.intimacy }],
      };
      await applyEffects(clamped, tx, ctx);

      // 从事务获取钳制后的实际金币变动
      const goldEffect = clamped.find((e) => e.kind === "gold") as { kind: "gold"; delta: number } | undefined;
      const clampedGoldChange = goldEffect?.delta ?? 0;

      // 对话历史（非标准效果，单独处理）
      const currentHistory: any[] = json.dialogueHistory(familyMember.dialogueHistory);
      const newHistory = [
        ...currentHistory,
        { role: "player", content: playerMessage, timestamp: Date.now() },
        { role: "npc", content: result.narrative, timestamp: Date.now() + 1 },
      ].slice(-50);
      await tx.familyMember.update({
        where: { id: familyMember.id },
        data: { dialogueHistory: JSON.stringify(newHistory) },
      });

      // 在事务内返回最新修炼者数据和实际金币变动
      return { updatedCultivator: await tx.cultivator.findUnique({ where: { id: c.id } }), clampedGoldChange };
    });

    const { updatedCultivator, clampedGoldChange } = transactionResult;
    const familyResult = { ...result, goldChange: clampedGoldChange, cultivator: updatedCultivator };
    if (isStream) {
      return streamNarrativeResult(familyMember.id, result, familyResult, updatedCultivator);
    }
    return NextResponse.json(familyResult);
  } catch (error) {
    logger.error("家庭对话生成失败:", error);
    return NextResponse.json({ error: "对话生成失败" }, { status: 500 });
  }
}