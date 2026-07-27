import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const rawPage  = parseInt(searchParams.get("page")  || "1");
  const rawLimit = parseInt(searchParams.get("limit") || "20");
  const page  = Math.max(1, Number.isNaN(rawPage)  ? 1 : rawPage);
  const limit = Math.min(50, Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit));

  if (!userId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { cultivator: { select: { id: true } } },
  });
  if (!user?.cultivator) return NextResponse.json({ error: "修炼者不存在" }, { status: 404 });

  const [events, total] = await Promise.all([
    prisma.gameEvent.findMany({
      where: { cultivatorId: user.cultivator.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gameEvent.count({ where: { cultivatorId: user.cultivator.id } }),
  ]);

  return NextResponse.json({ events, total, page, limit, hasMore: page * limit < total });
}
