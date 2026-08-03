import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/api-error";

async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  if (request.method === "GET") {
    const activeEvents = await prisma.worldEvent.findMany({
      where: { cultivatorId: cultivator.id, resolved: false },
      orderBy: { startedAt: "desc" },
    });
    return NextResponse.json({ events: activeEvents });
  }

  if (request.method === "POST") {
    // 参与事件：结算 effect（attrBonus → 永久属性），标记 resolved
    const body = await request.json().catch(() => ({}));
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    if (!eventId) return NextResponse.json({ error: "缺少 eventId" }, { status: 400 });

    const event = await prisma.worldEvent.findFirst({
      where: { id: eventId, cultivatorId: cultivator.id, resolved: false },
    });
    if (!event) return NextResponse.json({ error: "事件不存在或已结束" }, { status: 404 });

    let effectApplied: string | null = null;
    await prisma.$transaction(async (tx) => {
      if (event.effect) {
        const effect = JSON.parse(event.effect) as {
          attrBonus?: Record<string, number>;
          speedBonus?: number;
        };
        if (effect.attrBonus && Object.keys(effect.attrBonus).length > 0) {
          const currentAttrs = (() => {
            try {
              return JSON.parse(cultivator.attributes || "{}");
            } catch {
              return {};
            }
          })();
          const merged = { ...currentAttrs };
          for (const [k, v] of Object.entries(effect.attrBonus)) {
            merged[k] = (merged[k] || 0) + v;
          }
          await tx.cultivator.update({
            where: { id: cultivator.id },
            data: { attributes: JSON.stringify(merged) },
          });
          effectApplied = Object.entries(effect.attrBonus)
            .map(([k, v]) => `${k}+${v}`)
            .join("，");
        }
        // speedBonus 为修炼速度临时加成，当前数值管线未接入，仅记录不结算
      }
      await tx.worldEvent.update({
        where: { id: event.id },
        data: { resolved: true, elapsed: event.duration },
      });
    });

    return NextResponse.json({ success: true, effectApplied });
  }

  return NextResponse.json({ error: "不支持的请求方法" }, { status: 405 });
}

export const GET = withApiErrorHandling(handler);
export const POST = withApiErrorHandling(handler);
