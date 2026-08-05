import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

interface ArcadeGame {
  id: string;
  name: string;
  cost: number;
  maxPrize: number;
  desc: string;
}

const GAMES: ArcadeGame[] = [
  { id: "dice", name: "掷骰赌运", cost: 5, maxPrize: 30, desc: "一掷定乾坤，输赢在天道。" },
  { id: "fishing", name: "灵池垂钓", cost: 3, maxPrize: 15, desc: "静心垂钓，偶有灵鱼上钩。" },
  { id: "puzzle", name: "幻阵解谜", cost: 4, maxPrize: 20, desc: "破解幻阵，考验心性。" },
];

interface ArcadeStats {
  played: number;
  wins: number;
  gold: number;
}

function parseStats(raw: string | null): ArcadeStats {
  if (!raw) return { played: 0, wins: 0, gold: 0 };
  try {
    const v = JSON.parse(raw) as Partial<ArcadeStats>;
    return { played: v.played ?? 0, wins: v.wins ?? 0, gold: v.gold ?? 0 };
  } catch {
    return { played: 0, wins: 0, gold: 0 };
  }
}

// GET — 游艺统计与可玩项目
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    return NextResponse.json({ arcadeStats: parseStats(cultivator.arcadeStats), games: GAMES });
  } catch (error) {
    logger.error("获取游艺信息失败:", error);
    return NextResponse.json({ error: "获取游艺信息失败" }, { status: 500 });
  }
}

// POST — 游玩一个项目
async function postHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const body = await parseJsonBody(request);
  const game = GAMES.find((g) => g.id === body?.gameId);
  if (!game) {
    return NextResponse.json({ error: "未找到该游艺" }, { status: 404 });
  }
  if (cultivator.gold < game.cost) {
    return NextResponse.json({ error: "灵石不足" }, { status: 400 });
  }

  const win = Math.random() < 0.45;
  const prize = win ? 1 + Math.floor(Math.random() * game.maxPrize) : 0;
  const goldChange = prize - game.cost;

  const stats = parseStats(cultivator.arcadeStats);
  stats.played += 1;
  if (win) stats.wins += 1;
  stats.gold += goldChange;

  const updated = await prisma.cultivator.update({
    where: { id: cultivator.id },
    data: { gold: { increment: goldChange }, arcadeStats: JSON.stringify(stats) },
  });

  return NextResponse.json({
    success: true,
    game: game.name,
    win,
    prize,
    cost: game.cost,
    goldChange,
    gold: updated.gold,
    arcadeStats: stats,
  });
}

export const POST = withApiErrorHandling(postHandler);
