import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import {
  TALENT_DEFS,
  MAX_SLOTS,
  UNLOCK_COSTS,
  upgradeCost,
  maxLevelFor,
  parseTalentSlots,
  TalentType,
} from "@/lib/talent-slot-data";

export async function GET(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator as any;
  return NextResponse.json({
    defs: TALENT_DEFS,
    maxSlots: MAX_SLOTS,
    unlockCosts: UNLOCK_COSTS,
    reincarnationMark: c.reincarnationMark || 0,
    talentSlots: parseTalentSlots(c.talentSlots),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type } = body;

    if (action !== "unlock" && action !== "upgrade") {
      return apiError("无效操作（需 unlock/upgrade）", 400);
    }
    if (!type || !(type in TALENT_DEFS)) {
      return apiError("无效天赋", 400, "INVALID_TALENT");
    }

    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator as any;
    const slots = parseTalentSlots(c.talentSlots);
    const t = type as TalentType;

    if (action === "unlock") {
      if (slots.length >= MAX_SLOTS) return apiError("天赋槽已满（最大 3）", 400, "SLOT_FULL");
      if (slots.find((s) => s.type === t)) return apiError("该天赋已解锁", 400, "ALREADY_UNLOCKED");
      const cost = UNLOCK_COSTS[slots.length];
      if ((c.reincarnationMark || 0) < cost) return apiError(`轮回印记不足（需 ${cost}）`, 400, "MARK_INSUFFICIENT");
      slots.push({ type: t, level: 1 });
      const updated = await prisma.cultivator.update({
        where: { id: c.id },
        data: { reincarnationMark: { decrement: cost }, talentSlots: JSON.stringify(slots) },
      });
      return NextResponse.json({ success: true, action: "unlock", cultivator: updated, talentSlots: slots });
    }

    // upgrade
    const idx = slots.findIndex((s) => s.type === t);
    if (idx < 0) return apiError("该天赋尚未解锁", 400, "NOT_UNLOCKED");
    const cur = slots[idx];
    const maxLv = maxLevelFor(t);
    if (cur.level >= maxLv) return apiError("已达等级上限", 400, "MAX_LEVEL");
    const cost = upgradeCost(idx, cur.level);
    if ((c.reincarnationMark || 0) < cost) return apiError(`轮回印记不足（需 ${cost}）`, 400, "MARK_INSUFFICIENT");
    slots[idx] = { ...cur, level: cur.level + 1 };
    const updated = await prisma.cultivator.update({
      where: { id: c.id },
      data: { reincarnationMark: { decrement: cost }, talentSlots: JSON.stringify(slots) },
    });
    return NextResponse.json({ success: true, action: "upgrade", cultivator: updated, talentSlots: slots });
  } catch (error) {
    return NextResponse.json({ error: "天赋槽操作失败" }, { status: 500 });
  }
}
