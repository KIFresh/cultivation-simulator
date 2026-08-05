import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/api-error";

async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const url = new URL(request.url);
  const method = request.method;

  switch (method) {
    case "GET": {
      const relations = await prisma.npcRelation.findMany({
        where: { cultivatorId: cultivator.id },
        orderBy: { intimacy: "desc" },
      });
      return NextResponse.json({ relations });
    }

    case "PUT": {
      const body = await request.json().catch(() => ({}));
      const { npcId, npcName, relationType, intimacy, historyText } = body;
      if (!npcId || !npcName) {
        return NextResponse.json({ error: "缺少 npcId 或 npcName" }, { status: 400 });
      }

      const existing = await prisma.npcRelation.findUnique({
        where: { cultivatorId_npcId: { cultivatorId: cultivator.id, npcId } },
        select: { history: true, intimacy: true },
      });
      const prevHistory: Array<{ ts: string; text: string }> = existing?.history
        ? JSON.parse(existing.history)
        : [];
      const nextHistory =
        typeof historyText === "string" && historyText.trim()
          ? [...prevHistory, { ts: new Date().toISOString(), text: historyText.trim() }].slice(-20)
          : prevHistory;

      const relation = await prisma.npcRelation.upsert({
        where: {
          cultivatorId_npcId: { cultivatorId: cultivator.id, npcId },
        },
        create: {
          cultivatorId: cultivator.id,
          npcId,
          npcName,
          relationType: relationType || "认识",
          intimacy: intimacy ?? 50,
          history: JSON.stringify(nextHistory),
        },
        update: {
          npcName,
          ...(relationType !== undefined && { relationType }),
          ...(intimacy !== undefined && { intimacy: Math.max(0, Math.min(100, intimacy)) }),
          history: JSON.stringify(nextHistory),
        },
      });

      return NextResponse.json({ relation });
    }

    case "DELETE": {
      const npcId = url.searchParams.get("npcId");
      if (!npcId) return NextResponse.json({ error: "缺少 npcId" }, { status: 400 });

      await prisma.npcRelation.deleteMany({
        where: { cultivatorId: cultivator.id, npcId },
      });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "不支持的请求方法" }, { status: 405 });
  }
}

export const GET = withApiErrorHandling(handler);
export const PUT = withApiErrorHandling(handler);
export const DELETE = withApiErrorHandling(handler);