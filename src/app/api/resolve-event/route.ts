import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { parseAttributes } from "@/lib/inventory-utils";
import { MORTAL_EVENTS, DINNER_EVENTS, FESTIVAL_EVENTS, EXAM_EVENTS } from "@/lib/mortal-events";

// 可叠加进 attributes 的属性白名单（health 单独 clamp 处理）
const ATTR_KEYS = ["root", "spirit", "insight", "luck", "charm", "mind"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eventId, optionIndex } = body;
    if (!userId || typeof eventId !== "string" || typeof optionIndex !== "number") {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 鉴权：复用项目现有的 requireCultivator，不自建
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    // 按 eventId 找事件（日常事件池与饭桌事件池均检索）
    const event = [...MORTAL_EVENTS, ...DINNER_EVENTS, ...FESTIVAL_EVENTS, ...EXAM_EVENTS].find((e) => e.id === eventId);
    if (!event) {
      return NextResponse.json({ error: "事件不存在" }, { status: 400 });
    }
    const idx = optionIndex as number;
    if (idx < 0 || idx >= event.options.length) {
      return NextResponse.json({ error: "选项越界" }, { status: 400 });
    }
    const option = event.options[idx];

    // 应用选项效果：root/spirit/insight/luck/charm/mind 增量叠加；health clamp 0..100
    const attrs = parseAttributes(cultivator.attributes);
    let health = cultivator.health;
    for (const [key, delta] of Object.entries(option.effects) as [string, number][]) {
      if ((ATTR_KEYS as readonly string[]).includes(key)) {
        attrs[key] = (attrs[key] || 0) + delta;
      } else if (key === "health") {
        health = Math.max(0, Math.min(100, health + delta));
      }
    }

    // 凡人经济自循环：金币收支（来源/ sink），clamp 不低于 0
    const goldDelta = option.gold ?? 0;
    const newGold = Math.max(0, (cultivator.gold ?? 0) + goldDelta);

    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: {
        attributes: JSON.stringify(attrs),
        ...(health !== cultivator.health ? { health } : {}),
        ...(newGold !== cultivator.gold ? { gold: newGold } : {}),
      },
    });

    // 应用父母亲密度效果（familyEffects.parentIntimacy）：遍历所有存活父母，各写一份亲密度（双亲对称）
    const pIntimacy = option.familyEffects?.parentIntimacy;
    if (typeof pIntimacy === "number" && pIntimacy !== 0) {
      const parents = await prisma.familyMember.findMany({
        where: {
          cultivatorId: cultivator.id,
          relation: { in: ["父亲", "母亲", "养父", "养母"] },
          alive: true,
        },
      });
      for (const parent of parents) {
        const newIntimacy = Math.max(0, Math.min(100, parent.intimacy + pIntimacy));
        await prisma.familyMember.update({
          where: { id: parent.id },
          data: { intimacy: newIntimacy },
        });
      }
    }

    await prisma.gameEvent.create({
      data: {
        cultivatorId: cultivator.id,
        type: "DAILY_EVENT",
        title: event.text.slice(0, 20),
        narrative: option.narrative,
        reward: JSON.stringify({ eventId, optionIndex: idx }),
      },
    });

    return NextResponse.json({ cultivator: updated, narrative: option.narrative });
  } catch (error) {
    return NextResponse.json({ error: "事件结算失败" }, { status: 500 });
  }
}
