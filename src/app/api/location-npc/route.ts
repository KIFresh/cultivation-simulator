import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";

interface NpcDef {
  name: string;
  title: string;
  location: string;
  disposition: string;
  description: string;
}

const NPC_DIRECTORY: Record<string, NpcDef[]> = {
  home: [
    { name: "管家老周", title: "忠仆", location: "home", disposition: "友善", description: "照料府中琐事，知晓主人家底。" },
  ],
  market: [
    { name: "商会掌柜", title: "商修", location: "market", disposition: "精明", description: "贩卖奇物灵材，消息灵通。" },
    { name: "市井说书人", title: "散修", location: "market", disposition: "热心", description: "走南闯北，知晓诸多闲闻。" },
  ],
  sect: [
    { name: "守山弟子", title: "门人", location: "sect", disposition: "严正", description: "把守山门，考验来者诚心。" },
  ],
  square: [
    { name: "江湖游医", title: "游方修士", location: "square", disposition: "随和", description: "悬壶济世，亦售丹方。" },
  ],
};

function npcsAt(location: string): NpcDef[] {
  return NPC_DIRECTORY[location] ?? NPC_DIRECTORY.home ?? [];
}

// GET — 列出当前地点的人物
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    const location = cultivator.location ?? "home";
    return NextResponse.json({ location, npcs: npcsAt(location) });
  } catch (error) {
    console.error("获取地点人物失败:", error);
    return NextResponse.json({ error: "无法加载地点人物" }, { status: 500 });
  }
}

// POST — 与地点人物交互
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const action = body?.action;
    const npcName = body?.npcName;

    const location = cultivator.location ?? "home";
    const pool = npcsAt(location);
    const npc = pool.find((n) => n.name === npcName) ?? pool[0];
    if (!npc) {
      return NextResponse.json({ error: "此地暂无可交谈之人" }, { status: 404 });
    }

    const responses = [
      `${npc.name}（${npc.title}）：${npc.description}「道友今日气色不错，可有什么需要帮忙的？」`,
      `${npc.name}（${npc.title}）微微一笑：「修行之路漫漫，切记稳中求进。」`,
      `${npc.name}（${npc.title}）压低声音：「近来坊间有些风声，道友不妨留意。」`,
    ];
    const message = responses[Math.floor(Math.random() * responses.length)];

    return NextResponse.json({
      location,
      npc: { name: npc.name, title: npc.title, disposition: npc.disposition },
      action: action ?? "dialogue",
      message,
    });
  } catch (error) {
    console.error("与地点人物交互失败:", error);
    return NextResponse.json({ error: "交互失败" }, { status: 500 });
  }
}
