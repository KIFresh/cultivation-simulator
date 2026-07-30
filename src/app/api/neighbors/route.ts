import { NextRequest, NextResponse } from "next/server";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  rollInitialNeighbors,
  interactNeighbor,
  isNeighbor,
  clampIntimacy,
  type NeighborNpc,
  type NeighborAction,
} from "@/lib/neighbors";
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

function isMortal(c: { worldId?: string | null; realm?: string | null }): boolean {
  return c.worldId === "earth" && c.realm === "凡人";
}

// GET：返回邻居列表；凡人界首访自动生成初始邻居。
async function getHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator;

  const relations = parseRelations(c.npcRelations);
  let neighbors = (Object.values(relations).filter(isNeighbor) as NeighborNpc[]).sort(
    (a, b) => a.intimacy - b.intimacy
  );

  if (neighbors.length === 0 && isMortal(c) && (c.age ?? 1) >= 3) {
    const init = rollInitialNeighbors(c.id, c.age ?? 1, c.fate);
    const merged = { ...relations };
    for (const n of init) merged[n.name] = n;
    await prisma.cultivator.update({
      where: { id: c.id },
      data: { npcRelations: JSON.stringify(merged) },
    });
    neighbors = init;
  }

  return NextResponse.json({ neighbors, gold: c.gold ?? 0, age: c.age ?? 1 });
}

export const GET = withApiErrorHandling(getHandler);

// POST：邻里互动（唠家常 / 送心意 / 搭把手）。
async function postHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator;

  if (!isMortal(c)) return apiError("该功能仅限凡人界");

  const body = await parseJsonBody(request);
  const { action, neighborName } = body as { action: NeighborAction; neighborName: string };
  if (!action || !neighborName) return apiError("缺少互动参数");
  if (!["gossip", "gift", "help"].includes(action)) return apiError("未知互动类型");

  const age = c.age ?? 1;
  if (age < 3) return apiError("年纪太小，还不会和邻居打交道");

  const relations = parseRelations(c.npcRelations);
  const neighbor = relations[neighborName];
  if (!neighbor || !isNeighbor(neighbor)) return apiError("该邻居不存在");

  const res = interactNeighbor(neighbor, action);
  if ((c.gold ?? 0) < -res.goldDelta) return apiError("金币不足");

  const newIntimacy = clampIntimacy(neighbor.intimacy + res.intimacyDelta);
  const updated: NeighborNpc = { ...neighbor, intimacy: newIntimacy };
  const merged = { ...relations, [neighborName]: updated };

  const updateData: Record<string, unknown> = { npcRelations: JSON.stringify(merged) };
  if (res.goldDelta !== 0) updateData.gold = { increment: res.goldDelta };
  if (res.attr && res.attrDelta) updateData[res.attr] = { increment: res.attrDelta };

  const updatedC = await prisma.cultivator.update({
    where: { id: c.id },
    data: updateData as Parameters<typeof prisma.cultivator.update>[0]["data"],
  });

  return NextResponse.json({
    result: res,
    neighbor: updated,
    gold: updatedC.gold,
  });
}

export const POST = withApiErrorHandling(postHandler);
