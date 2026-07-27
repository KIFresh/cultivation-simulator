import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";

interface WeatherDef {
  key: string;
  label: string;
  desc: string;
  effect: { type: string; value: number };
}

const WEATHER_TYPES: WeatherDef[] = [
  { key: "晴", label: "晴空万里", desc: "灵气平和，适合吐纳修行。", effect: { type: "spirit", value: 2 } },
  { key: "雨", label: "灵雨纷飞", desc: "雨水润泽，悟性稍涨。", effect: { type: "insight", value: 2 } },
  { key: "雷", label: "雷劫隐现", desc: "天雷淬体，凶险与机缘并存。", effect: { type: "root", value: 3 } },
  { key: "雾", label: "迷雾笼罩", desc: "视野受阻，机缘稍减。", effect: { type: "luck", value: -1 } },
  { key: "雪", label: "寒霜覆地", desc: "寒气侵体，需耗体力御寒。", effect: { type: "stamina", value: -3 } },
];

// POST — 感知当前天时（无请求体）
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const base = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
    const location = cultivator.location ?? "未知之地";

    await prisma.gameEvent
      .create({
        data: {
          cultivatorId: cultivator.id,
          type: "WEATHER",
          title: `天象·${base.label}`,
          narrative: `${location}今日${base.label}。${base.desc}`,
          reward: JSON.stringify({ weather: base.key, effect: base.effect }),
        },
      })
      .catch(() => {});

    return NextResponse.json({
      weather: base.key,
      label: base.label,
      description: base.desc,
      location,
      effect: base.effect,
    });
  } catch (error) {
    console.error("感知天时失败:", error);
    return NextResponse.json({ error: "无法感知天时" }, { status: 500 });
  }
}
