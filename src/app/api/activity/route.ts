import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableActivities, applyActivityEffects } from "@/lib";
import { sanitizeAttributes } from "@/lib/utils";


import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, activityId, attributes } = body;
    if (!userId || !activityId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator;
    const isAwake = c.realm !== "凡人";
    const activities = getAvailableActivities(c.age, isAwake);
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return NextResponse.json({ error: "无效的活动" }, { status: 400 });

    if (c.stamina < activity.staminaCost) return NextResponse.json({ error: "行动力不足" }, { status: 400 });

    const currentAttrs: Record<string, number> = sanitizeAttributes(attributes) || {};
    const newAttrs = applyActivityEffects(activity, currentAttrs);

    const [updated] = await prisma.$transaction([
      prisma.cultivator.update({
        where: { id: c.id },
        data: { stamina: { decrement: activity.staminaCost }, gold: { increment: activity.goldDelta }, attributes: JSON.stringify(newAttrs) }}),
    ]);

    return NextResponse.json({
      cultivator: updated,
      newAttributes: newAttrs,
      activityName: activity.name,
      goldDelta: activity.goldDelta});
  } catch (error) {
    logger.error("活动执行失败:", error);
    return NextResponse.json({ error: "活动执行失败" }, { status: 500 });
  }
}