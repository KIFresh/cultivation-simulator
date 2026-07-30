import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { withApiErrorHandling } from "@/lib/api-error";

const getHandler = async (request: NextRequest) => {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const { searchParams } = new URL(request.url);
  const rawPage = parseInt(searchParams.get("page") || "1");
  const rawLimit = parseInt(searchParams.get("limit") || "20");
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(50, Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit));

  const [events, total] = await Promise.all([
    prisma.gameEvent.findMany({
      where: { cultivatorId: cultivator.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.gameEvent.count({ where: { cultivatorId: cultivator.id } }),
  ]);

  return NextResponse.json({ events, total, page, limit, hasMore: page * limit < total });
};

export const GET = withApiErrorHandling(getHandler);
