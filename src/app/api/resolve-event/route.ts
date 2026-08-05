import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { parseAttributes } from "@/lib/inventory-utils";
import { addAttrExp } from "@/lib/location-events";
import { json } from "@/lib/json-helper";
import { MORTAL_EVENTS, DINNER_EVENTS, FESTIVAL_EVENTS, EXAM_EVENTS } from "@/lib/mortal-events";
import {
  applyEffects,
  clampEffectsArray,
  type NarrativeEffect,
  type ClampConfig,
} from "@/lib/narrative-effects";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

async function postHandler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { eventId, optionIndex } = body;
  if (typeof eventId !== "string" || typeof optionIndex !== "number") {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const event = [...MORTAL_EVENTS, ...DINNER_EVENTS, ...FESTIVAL_EVENTS, ...EXAM_EVENTS].find(
    (e) => e.id === eventId
  );
  if (!event) {
    return NextResponse.json({ error: "事件不存在" }, { status: 400 });
  }
  const idx = optionIndex as number;
  if (idx < 0 || idx >= event.options.length) {
    return NextResponse.json({ error: "选项越界" }, { status: 400 });
  }
  const option = event.options[idx];

  // 构建效果契约
  const effects: NarrativeEffect[] = [];
  const goldDelta = option.gold ?? 0;
  if (goldDelta !== 0) effects.push({ kind: "gold", delta: goldDelta });

  const healthDelta = option.effects?.health ?? 0;
  if (healthDelta !== 0) effects.push({ kind: "health", delta: healthDelta });

  // attrExp 属性：root/spirit/insight/luck/charm/mind（落库走事务内 addAttrExp）
  const attrExpValues: Record<string, number> = {};
  for (const [key, delta] of Object.entries(option.effects) as [string, number][]) {
    if (["root", "spirit", "insight", "luck", "charm", "mind"].includes(key)) {
      attrExpValues[key] = (attrExpValues[key] || 0) + delta;
    }
  }

  const clampConfig: ClampConfig = {
    currentGold: cultivator.gold ?? 0,
    currentStamina: cultivator.stamina,
    maxStamina: 100,
    maxGoldAbsDelta: 10_000,
  };
  const clamped = clampEffectsArray(effects, clampConfig);

  // 应用父母亲密度效果（familyEffects.parentIntimacy）
  const pIntimacy = option.familyEffects?.parentIntimacy;

  await prisma.$transaction(async (tx: any) => {
    // 1. 效果契约处理 gold/health
    await applyEffects(clamped, tx, {
      cultivatorId: cultivator.id,
      currentGold: cultivator.gold ?? 0,
      currentStamina: cultivator.stamina,
      maxStamina: 100,
      cultivatorAge: cultivator.age,
    });

    // 1.5 属性经验统一走 addAttrExp（与 location-event 一致的 exp/level 折算）
    if (Object.keys(attrExpValues).length > 0) {
      const current = await tx.cultivator.findUnique({
        where: { id: cultivator.id },
        select: { attributeExp: true },
      });
      const attrExpData = json.attributeExp(current?.attributeExp) || {};
      const next = addAttrExp(attrExpData, attrExpValues);
      await tx.cultivator.update({
        where: { id: cultivator.id },
        data: { attributeExp: JSON.stringify(next) },
      });
    }

    // 2. 父母亲密度（不在效果契约中，单独处理）
    if (typeof pIntimacy === "number" && pIntimacy !== 0) {
      const parents = await tx.familyMember.findMany({
        where: {
          cultivatorId: cultivator.id,
          relation: { in: ["父亲", "母亲", "养父", "养母"] },
          alive: true,
        },
      });
      for (const parent of parents) {
        const newIntimacy = Math.max(0, Math.min(100, parent.intimacy + pIntimacy));
        await tx.familyMember.update({
          where: { id: parent.id },
          data: { intimacy: newIntimacy },
        });
      }
    }

    // 3. 记录事件日志
    await tx.gameEvent.create({
      data: {
        cultivatorId: cultivator.id,
        type: "DAILY_EVENT",
        title: event.text.slice(0, 20),
        narrative: option.narrative,
        reward: JSON.stringify({ eventId, optionIndex: idx }),
      },
    });
  });

  // 重新读取以获取最新状态
  const updated = await prisma.cultivator.findUnique({ where: { id: cultivator.id } });

  return NextResponse.json({ cultivator: updated, narrative: option.narrative });
}

export const POST = withApiErrorHandling(postHandler);
