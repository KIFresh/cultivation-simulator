import { NextRequest, NextResponse } from "next/server";
// ═══════════════════════════════════════════════════════════════════════════
// family-dialogue/route.ts — 家庭对话 API
// 职责：
// 1. 生成家庭 NPC 对话叙事
// 2. 效果经由 clampEffectsArray + applyEffects 统一持久化
// 3. 白名单校验：效果 kind 必须在 FAMILY_DIALOGUE 白名单内
// ═══════════════════════════════════════════════════════════════════════════

import {
  generateFamilyDialogue,
  buildSummaryFromEntries,
  stateFromCultivator,
} from "@/lib/narrative";
import { streamNarrativeResult } from "@/lib/narrative-stream";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError, sanitizeString } from "@/lib/auth-helpers";
import { json } from "@/lib/json-helper";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import {
  applyEffects,
  clampEffectsArray,
  persistNarrativeMemory,
  type NarrativeEffect,
  type ApplyContext,
} from "@/lib/narrative-effects";
import { embedMemoryEntries } from "@/lib/embedding";
import { NARRATIVE_EFFECT_WHITELISTS, checkEffectWhitelist } from "@/lib/narrative-schema";
import { getGoldMaxGainByRealm } from "@/lib/gold";
import { sanitizeAttributes } from "@/lib/utils";
import { calculateMaxStamina } from "@/lib/cultivation-data";
function hasPhone(inventoryRaw: string | null): boolean {
  if (!inventoryRaw) return false;
  try {
    const inv: { itemId: string }[] = json.inventory(inventoryRaw);
    return inv.some((i) => i.itemId === "phone");
  } catch {
    return false;
  }
}

async function postHandler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { familyMemberName, familyMemberRelation } = body;
  const playerMessage = sanitizeString(body.playerMessage, 1000);
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
    where: {
      cultivatorId: c.id,
      relation: familyMemberRelation || "父亲",
      name: familyMemberName,
      alive: true,
    },
  });
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
  } catch (e) {
    logger.error("[family-dialogue/route.ts] 解析剧情记录失败:", e);
  }

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

    // 构建效果数组（优先使用 AI effects，否则从 intimacyDelta/goldChange 转换）
    const effects: NarrativeEffect[] = [{ kind: "stamina", delta: -apCost }];
    if (result.effects && result.effects.length > 0) {
      // 从 AI effects 中提取白名单内效果，体力消耗仍由服务端决定
      // 白名单校验
      const deniedKinds = checkEffectWhitelist(
        result.effects,
        NARRATIVE_EFFECT_WHITELISTS.FAMILY_DIALOGUE
      );
      if (deniedKinds.length > 0) {
        console.warn(`FAMILY_DIALOGUE: 拒绝白名单外效果 kind: ${deniedKinds.join(", ")}`);
      }
      for (const e of result.effects) {
        if (!deniedKinds.includes(e.kind)) {
          effects.push(e);
        }
      }
    } else {
      if (result.intimacyDelta) {
        effects.push({
          kind: "intimacy",
          targetRelation: familyMember.relation,
          delta: result.intimacyDelta,
        });
      }
      if (result.goldChange) {
        effects.push({ kind: "gold", delta: result.goldChange });
      }
    }

    // 按境界动态设置金币上限，一次钳制全量效果
    const maxGoldCap = getGoldMaxGainByRealm(freshC.realmLevel ?? 0);
    const clamped = clampEffectsArray(effects, {
      currentGold: freshC.gold ?? 0,
      currentStamina: freshC.stamina,
      maxStamina: calculateMaxStamina(
        freshC.age,
        sanitizeAttributes(freshC.attributes) ?? undefined
      ),
      maxGoldAbsDelta: maxGoldCap,
      currentIntimacy: familyMember.intimacy,
      maxIntimacy: 100,
      maxIntimacyAbsDelta: 8,
    });
    const ctx: ApplyContext = {
      cultivatorId: c.id,
      currentGold: freshC.gold ?? 0,
      currentStamina: freshC.stamina,
      maxStamina: calculateMaxStamina(
        freshC.age,
        sanitizeAttributes(freshC.attributes) ?? undefined
      ),
      familyMembers: [
        { relation: familyMember.relation, id: familyMember.id, intimacy: familyMember.intimacy },
      ],
      cultivatorAge: freshC.age,
    };
    await applyEffects(clamped, tx, ctx);

    // 对话叙事写入记忆面板（带年龄/境界，事务提交后异步补 embedding）
    const memId = await persistNarrativeMemory(tx, freshC, {
      title: result.title || `与${familyMember.relation}交谈`,
      summary: (result.narrative || "").slice(0, 60),
      narrative: result.narrative,
    });

    // 从事务获取钳制后的实际金币变动
    const goldEffect = clamped.find((e) => e.kind === "gold") as
      { kind: "gold"; delta: number } | undefined;
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
    return {
      updatedCultivator: await tx.cultivator.findUnique({ where: { id: c.id } }),
      clampedGoldChange,
      memoryId: memId,
    };
  });

  const { updatedCultivator, clampedGoldChange, memoryId } = transactionResult;
  if (memoryId) {
    embedMemoryEntries([memoryId]).catch(() => {});
  }
  const familyResult = { ...result, goldChange: clampedGoldChange, cultivator: updatedCultivator };
  if (isStream) {
    return streamNarrativeResult(familyMember.id, result, familyResult, updatedCultivator);
  }
  return NextResponse.json(familyResult);
}
export const POST = withApiErrorHandling(postHandler);
