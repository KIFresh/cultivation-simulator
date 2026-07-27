import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// 登出：清除 HttpOnly 会话 cookie。
// 前端 JS 无法清除 HttpOnly cookie（document.cookie 对其无效），必须由服务端下发清除指令。
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
