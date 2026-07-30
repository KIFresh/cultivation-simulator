import { NextRequest, NextResponse } from "next/server";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  LOCATION_EVENT_POOL,
  rollLocationEvent,
  addAttrExp,
  makeLocationNpcStub,
} from "@/lib/location-events";
import { json } from "@/lib/json-helper";
import {
  createEntry,
  buildSummaryFromEntries,
  compressStorySummary,
  type StoryEntry,
} from "@/lib/narrative";
import { clampGoldDelta } from "@/lib/gold";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

function parseRelations(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    return typeof p === "object" && p ? (p as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET：为当前地点摇一个事件（当天同人同地稳定）
async function getHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator;
  const locationId = c.location || "home";
  const age = c.age ?? 1;
  const event = rollLocationEvent(c.id, locationId, age, dayKey());
  return NextResponse.json({ locationId, event: event ?? null });
}

// POST：应用指定事件的效果（金币/健康/属性经验/相遇NPC/记忆）
async function postHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator;
  const locationId = c.location || "home";
  const age = c.age ?? 1;

  const body = await parseJsonBody(request);
  const { eventId } = body as { eventId: string };
  if (!eventId) return apiError("缺少事件参数");

  const event = (LOCATION_EVENT_POOL[locationId] || []).find((e) => e.id === eventId);
  if (!event) return apiError("该地点无此事件");
  if (age < event.minAge) return apiError("年龄不足");

  const fx = event.effects;
  const updateData: Record<string, unknown> = {};

  // 金币
  if (fx.goldDelta && fx.goldDelta !== 0) {
    const clamped = clampGoldDelta(fx.goldDelta, c.gold ?? 0);
    if (fx.goldDelta < 0 && clamped !== fx.goldDelta) return apiError("金币不足");
    updateData.gold = { increment: clamped };
  }
  // 健康
  if (fx.healthDelta && fx.healthDelta !== 0) {
    const MAX = 100;
    const cur = c.health ?? MAX;
    updateData.health = Math.min(MAX, Math.max(0, cur + fx.healthDelta));
  }
  // 属性经验
  if (fx.attrExp && Object.keys(fx.attrExp).length > 0) {
    const attrExpData = json.attributeExp(c.attributeExp) || {};
    const next = addAttrExp(attrExpData, fx.attrExp);
    updateData.attributeExp = JSON.stringify(next);
  }
  // 遇见 NPC（写入 location_npc 桩，Phase 2 扩展互动）
  if (fx.npcMeet) {
    const relations = parseRelations(c.npcRelations);
    if (!relations[fx.npcMeet]) {
      relations[fx.npcMeet] = makeLocationNpcStub(fx.npcMeet, locationId, age);
      updateData.npcRelations = JSON.stringify(relations);
    }
  }
  // 记忆（storyEntries）
  if (fx.memory) {
    const entries: StoryEntry[] = json.storyEntries(c.storyEntries);
    const summaryText = buildSummaryFromEntries(entries);
    const newEntry = createEntry(event.title, event.description, true, summaryText);
    let updated = [...entries, newEntry];
    const newSummary = buildSummaryFromEntries(updated);
    if (updated.length > 50 || newSummary.length > 1000) {
      const compressed = await compressStorySummary(updated, c.name);
      updated = [
        ...updated.filter((e) => e.important),
        createEntry("📜 记忆凝练", compressed, false),
      ];
    }
    updateData.storyEntries = JSON.stringify(updated);
    updateData.storyEntriesUpdatedAt = new Date();
  }

  const updatedC = await prisma.cultivator.update({
    where: { id: c.id },
    data: updateData as Parameters<typeof prisma.cultivator.update>[0]["data"],
  });

  return NextResponse.json({
    event,
    gold: updatedC.gold,
    health: updatedC.health,
    attributeExp: updatedC.attributeExp,
    npcRelations: updatedC.npcRelations,
    storyEntries: updatedC.storyEntries,
  });
}

export const GET = withApiErrorHandling(getHandler);
export const POST = withApiErrorHandling(postHandler);
