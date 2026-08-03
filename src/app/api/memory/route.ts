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
      const id = url.searchParams.get("id");
      if (id) {
        const entry = await prisma.memoryEntry.findFirst({
          where: { id, cultivatorId: cultivator.id },
        });
        if (!entry) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
        return NextResponse.json({ entry });
      }

      const entries = await prisma.memoryEntry.findMany({
        where: { cultivatorId: cultivator.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json({ entries });
    }

    case "PATCH": {
      const body = await request.json().catch(() => ({}));
      const { id, title, summary, narrative, important, tags } = body;
      if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

      const existing = await prisma.memoryEntry.findFirst({
        where: { id, cultivatorId: cultivator.id },
      });
      if (!existing) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });

      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (summary !== undefined) data.summary = summary;
      if (narrative !== undefined) data.narrative = narrative;
      if (important !== undefined) data.important = important;
      if (tags !== undefined) data.tags = JSON.stringify(tags);

      const updated = await prisma.memoryEntry.update({
        where: { id },
        data,
      });
      return NextResponse.json({ entry: updated });
    }

    case "DELETE": {
      const id = url.searchParams.get("id");
      if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

      const existing = await prisma.memoryEntry.findFirst({
        where: { id, cultivatorId: cultivator.id },
      });
      if (!existing) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });

      await prisma.memoryEntry.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "不支持的请求方法" }, { status: 405 });
  }
}

export const GET = withApiErrorHandling(handler);
export const PATCH = withApiErrorHandling(handler);
export const DELETE = withApiErrorHandling(handler);