import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";

interface Formula {
  id: string;
  name: string;
  tier: string;
  cost: number;
  effect: string;
}

const FORMULAS: Formula[] = [
  { id: "qi_gathering_pill", name: "聚气丹方", tier: "凡阶", cost: 20, effect: "炼制聚气丹，回复体力。" },
  { id: "detox_pill", name: "清毒丹方", tier: "凡阶", cost: 25, effect: "炼制清毒丹，降低毒性。" },
  { id: "breakthrough_ink", name: "破境墨方", tier: "灵阶", cost: 60, effect: "辅助破境，提升成功率。" },
  { id: "spirit_veil", name: "隐灵丹方", tier: "灵阶", cost: 50, effect: "隐匿气息，奇遇更易。" },
];

function parseUnlocked(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

// GET — 丹方列表与已解锁情况
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    const unlocked = parseUnlocked(cultivator.unlockedFormulas);
    return NextResponse.json({
      unlockedFormulas: unlocked,
      formulas: FORMULAS.map((f) => ({ ...f, unlocked: unlocked.includes(f.id) })),
    });
  } catch (error) {
    console.error("获取丹方失败:", error);
    return NextResponse.json({ error: "获取丹方失败" }, { status: 500 });
  }
}

// POST — 习得（购买）一个丹方
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const formula = FORMULAS.find((f) => f.id === body?.formulaId);
    if (!formula) {
      return NextResponse.json({ error: "未找到该丹方", success: false }, { status: 404 });
    }

    const unlocked = parseUnlocked(cultivator.unlockedFormulas);
    if (unlocked.includes(formula.id)) {
      return NextResponse.json({ error: "已习得该丹方", success: false }, { status: 400 });
    }
    if (cultivator.gold < formula.cost) {
      return NextResponse.json({ error: "灵石不足，无法购得丹方", success: false }, { status: 400 });
    }

    const newUnlocked = [...unlocked, formula.id];
    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: { gold: { increment: -formula.cost }, unlockedFormulas: JSON.stringify(newUnlocked) },
    });

    return NextResponse.json({
      success: true,
      formula,
      unlockedFormulas: newUnlocked,
      gold: updated.gold,
    });
  } catch (error) {
    console.error("习得丹方失败:", error);
    return NextResponse.json({ error: "习得丹方失败" }, { status: 500 });
  }
}
