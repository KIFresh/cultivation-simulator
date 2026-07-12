import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

// POST — 注册
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password, cultivatorName, spiritualRoot } = body;

    if (!name || !password || !cultivatorName || !spiritualRoot) {
      return NextResponse.json({ error: "缺少必填信息" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "密码至少 4 位" }, { status: 400 });
    }

    // 查重
    const existing = await prisma.user.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "该账号名已被占用" }, { status: 409 });
    }

    const { hash, salt } = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        password: `${salt}:${hash}`,
        cultivator: {
          create: { name: cultivatorName, spiritualRoot },
        },
      },
      include: { cultivator: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("注册失败:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}

// PUT — 登录
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || !password) {
      return NextResponse.json({ error: "请输入账号名和密码" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { name },
      include: { cultivator: true },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    const [salt, storedHash] = user.password.split(":");
    const { hash } = hashPassword(password, salt);

    if (hash !== storedHash) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("登录失败:", error);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
