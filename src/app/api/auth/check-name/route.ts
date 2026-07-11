import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { name } });
  return NextResponse.json({ exists: !!user });
}