import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { logger } from "@/lib/logger";
import { signSession, SESSION_COOKIE_NAME } from "@/lib/session";

/** 登录/注册成功后向响应写入 HttpOnly 签名会话 cookie */
function setSessionCookie(response: NextResponse, userId: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天
  });
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(password, s, 64).toString("hex");
  return { hash: h, salt: s };
}

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { action: "error", message: "请输入账号名和密码" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { name },
      include: { cultivator: true },
    });

    // 账号存在 → 验证密码
    if (existing) {
      if (!existing.password) {
        return NextResponse.json(
          { action: "error", message: "账号异常，请联系管理员" },
          { status: 401 }
        );
      }
      const [salt, storedHash] = existing.password.split(":");
      const { hash } = hashPassword(password, salt);
      if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash))) {
        return NextResponse.json(
          { action: "error", message: "密码错误" },
          { status: 401 }
        );
      }
      const { password: _pw, ...safeExisting } = existing;
      const response = NextResponse.json({ action: "login", user: safeExisting });
      setSessionCookie(response, existing.id);
      return response;
    }

    // 账号不存在 → 自动创建（仅 user，无 cultivator）
    if (password.length < 4) {
      return NextResponse.json(
        { action: "error", message: "密码至少 4 位" },
        { status: 400 }
      );
    }

    const { hash, salt } = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        password: `${salt}:${hash}`,
      },
    });

    const { password: _pw2, ...safeUser } = user;
    const response = NextResponse.json({ action: "created", user: safeUser });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    logger.error("统一登录/注册失败:", error);
    return NextResponse.json(
      { action: "error", message: "服务器错误" },
      { status: 500 }
    );
  }
}