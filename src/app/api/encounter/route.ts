import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  shouldTriggerEncounter,
  pickRandomEncounter,
  serializeEncounter,
  resolveHighRiskOutcome,
  applyRewardEffects,
} from "@/lib/encounter-data";
import { REALMS, getItemById } from "@/lib/cultivation-data";

// 奇遇特殊物品 → 实际道具 ID 映射
const ENCOUNTER_ITEM_MAP: Record<string, string> = {
  "获得「青云心法·残卷」": "ancient_tome",
  "获得「青冥剑·下品法宝」": "spirit_sword",
  "获得「灵狐之泪·炼丹圣品」": "demon_core",
  "获得「五尾灵狐」认你为主！": "spirit_beads",
  "缴获「骷髅杖·下品法器」": "iron_sword",
  "夺得「黑煞炼魂旗·中品法宝」": "spirit_robe",
};

// ============================================================
// GET — 尝试触发奇遇（在完成任务后调用 或 手动探索）
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const source = searchParams.get("source") || "auto"; // "manual" | "auto"

    if (!userId) {
      return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
    }

    // 获取修炼者信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { cultivator: true },
    });

    if (!user?.cultivator) {
      return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });
    }

    // 检查今日已触发的奇遇次数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const encountersToday = await prisma.gameEvent.count({
      where: {
        cultivatorId: user.cultivator.id,
        type: "ENCOUNTER",
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // 手动探索：最多3次尝试
    if (source === "manual") {
      // 统计今日通过手动探索创建（含失败）的尝试次数
      // 用 GameEvent 中 type=RANDOM_ENCOUNTER 且 title 含 "探索" 或通过 reward 字段判断
      // 简化方案：用 encountersToday >= 3 做硬上限
      if (encountersToday >= 3) {
        return NextResponse.json({
          triggered: false,
          encountersToday,
          reason: "今日机缘已尽，明日再寻访仙缘",
        });
      }
    }

    // 30% 概率触发
    if (!shouldTriggerEncounter()) {
      return NextResponse.json({
        triggered: false,
        encountersToday,
      });
    }

    // 随机抽取一个奇遇
    const encounter = pickRandomEncounter(encountersToday);
    if (!encounter) {
      return NextResponse.json({
        triggered: false,
        encountersToday,
        reason: "今日机缘已尽，明日再续仙途",
      });
    }

    // 创建游戏事件记录（尚未选择）
    const gameEvent = await prisma.gameEvent.create({
      data: {
        cultivatorId: user.cultivator.id,
        type: "ENCOUNTER",
        title: encounter.title,
        narrative: encounter.narrative,
        choices: JSON.stringify(
          encounter.choices.map((c) => ({
            riskLevel: c.riskLevel,
            text: c.text,
            hint: c.hint,
          }))
        ),
        chosenOption: null, // 尚未选择
        reward: null,
      },
    });

    return NextResponse.json({
      triggered: true,
      eventId: gameEvent.id,
      encounter: serializeEncounter(encounter),
      encountersToday: encountersToday + 1,
    });
  } catch (error) {
    console.error("触发奇遇失败:", error);
    return NextResponse.json({ error: "触发失败" }, { status: 500 });
  }
}

// ============================================================
// POST — 选择奇遇选项，结算奖励/惩罚
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, userId, choiceIndex } = body;

    if (!eventId || !userId || choiceIndex === undefined) {
      return NextResponse.json(
        { error: "缺少必填信息（eventId, userId, choiceIndex）" },
        { status: 400 }
      );
    }

    if (choiceIndex < 0 || choiceIndex > 2) {
      return NextResponse.json(
        { error: "选项无效，请选择 0/1/2（低/中/高风险）" },
        { status: 400 }
      );
    }

    // 获取事件和修炼者
    const gameEvent = await prisma.gameEvent.findUnique({
      where: { id: eventId },
    });
    if (!gameEvent || gameEvent.type !== "ENCOUNTER") {
      return NextResponse.json({ error: "奇遇不存在" }, { status: 404 });
    }
    if (gameEvent.chosenOption !== null) {
      return NextResponse.json({ error: "该奇遇已经结算" }, { status: 400 });
    }

    const cultivator = await prisma.cultivator.findUnique({
      where: { id: gameEvent.cultivatorId },
    });
    if (!cultivator) {
      return NextResponse.json({ error: "修炼者不存在" }, { status: 404 });
    }

    // 找到对应的奇遇数据（通过标题匹配）
    const { ENCOUNTER_POOL } = await import("@/lib/encounter-data");
    const encounter = ENCOUNTER_POOL.find(
      (e) => e.title === gameEvent.title
    );
    if (!encounter) {
      return NextResponse.json({ error: "奇遇数据异常" }, { status: 500 });
    }

    const choice = encounter.choices[choiceIndex];

    // 高风险选项：进行成功率判定
    let rewards = choice.rewards;
    let outcomeMessage = "";

    if (choice.riskLevel === "high") {
      const realmIdx = REALMS.findIndex(
        (r) => r.name === cultivator.realm
      );
      const success = resolveHighRiskOutcome({
        spiritualRoot: cultivator.spiritualRoot as import("@/lib").SpiritualRoot,
        realmIndex: realmIdx >= 0 ? realmIdx : 0,
        realmLevel: cultivator.realmLevel,
      });

      if (!success) {
        // 失败：反转奖励为惩罚
        rewards = choice.rewards.map((r) => {
          if (r.type === "cultivationExp") {
            return { ...r, value: -Math.abs(r.value), label: r.label.replace("+", "-") };
          }
          if (r.type === "specialItem") {
            return { ...r, label: r.label.replace("获得", "夺得") + "失败……" };
          }
          return r;
        });
        outcomeMessage = "然天道无常，机缘背后暗藏凶险……";
      } else {
        outcomeMessage = "天道垂青，你成功掌控了这份机缘！";
      }
    }

    // 应用奖励效果
    const result = applyRewardEffects(rewards, {
      cultivationExp: cultivator.cultivationExp,
      totalExp: cultivator.totalExp,
      stamina: cultivator.stamina,
    });

    // 处理特殊物品 → 加入背包
    let inventory: { itemId: string; quantity: number; equipped: boolean }[] = [];
    try {
      inventory = JSON.parse(cultivator.inventory || '[]');
    } catch {}

    for (const itemLabel of result.specialItems) {
      const itemId = ENCOUNTER_ITEM_MAP[itemLabel];
      if (itemId) {
        const existing = inventory.find((s) => s.itemId === itemId);
        if (existing) {
          existing.quantity += 1;
        } else {
          inventory.push({ itemId, quantity: 1, equipped: false });
        }
      }
    }

    // 更新修炼者状态
    const [updatedCultivator, updatedEvent] = await prisma.$transaction([
      prisma.cultivator.update({
        where: { id: cultivator.id },
        data: {
          cultivationExp: result.cultivationExp,
          totalExp: result.totalExp,
          stamina: result.stamina,
          inventory: JSON.stringify(inventory),
        },
      }),
      prisma.gameEvent.update({
        where: { id: eventId },
        data: {
          chosenOption: choiceIndex,
          reward: JSON.stringify({
            riskLevel: choice.riskLevel,
            effects: rewards,
            message: result.message,
          }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      choice: {
        riskLevel: choice.riskLevel,
        text: choice.text,
      },
      rewards: rewards.map((r) => r.label),
      message: result.message,
      outcomeMessage: outcomeMessage || undefined,
      narrative: choice.successNarrative,
      cultivator: {
        cultivationExp: updatedCultivator.cultivationExp,
        totalExp: updatedCultivator.totalExp,
        stamina: updatedCultivator.stamina,
      },
    });
  } catch (error) {
    console.error("结算奇遇失败:", error);
    return NextResponse.json({ error: "结算失败" }, { status: 500 });
  }
}
