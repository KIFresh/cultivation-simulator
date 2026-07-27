import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";

const TOPICS = ["修炼日常", "炼丹翻车", "门派趣闻", "奇遇分享", "灵兽卖萌"];

interface VideoEntry {
  id: string;
  title: string;
  narrative: string;
  createdAt: Date;
}

// GET — 已发布的短视频列表
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const videos = await prisma.gameEvent.findMany({
      where: { cultivatorId: cultivator.id, type: "SHORT_VIDEO" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const result: VideoEntry[] = videos.map((v) => ({
      id: v.id,
      title: v.title,
      narrative: v.narrative,
      createdAt: v.createdAt,
    }));

    return NextResponse.json({ videos: result });
  } catch (error) {
    console.error("获取短视频列表失败:", error);
    return NextResponse.json({ error: "获取短视频列表失败" }, { status: 500 });
  }
}

// POST — 发布一条短视频
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const title =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim()
        : "无名短片";
    const topic =
      typeof body?.topic === "string" && body.topic.trim()
        ? body.topic.trim()
        : TOPICS[Math.floor(Math.random() * TOPICS.length)];

    const views = 100 + Math.floor(Math.random() * 900);
    const goldGained = 2 + Math.floor(views / 100);
    const narrative = `${cultivator.name} 发布了一支关于「${topic}」的短视频《${title}》，播放量 ${views}，收获 ${goldGained} 灵石打赏。`;

    const [event] = await prisma.$transaction([
      prisma.gameEvent.create({
        data: {
          cultivatorId: cultivator.id,
          type: "SHORT_VIDEO",
          title: `短视频·${title}`,
          narrative,
          reward: JSON.stringify({ topic, views, goldGained }),
        },
      }),
      prisma.cultivator.update({
        where: { id: cultivator.id },
        data: { gold: { increment: goldGained } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      video: { id: event.id, title: event.title, narrative, topic, views, goldGained },
      gold: cultivator.gold + goldGained,
    });
  } catch (error) {
    console.error("发布短视频失败:", error);
    return NextResponse.json({ error: "发布短视频失败" }, { status: 500 });
  }
}
