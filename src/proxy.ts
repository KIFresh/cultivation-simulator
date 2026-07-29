import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Next 16 全局请求代理（取代 middleware.ts）。
 * 校验签名会话 cookie，向受信任的下游请求注入 `x-user-id` 头。
 * 各 API 路由通过 requireCultivator(request) 读取该头完成鉴权与所有权校验。
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const userId = verifySession(token);

  if (userId) {
    const headers = new Headers(request.headers);
    headers.set("x-user-id", userId);
    return NextResponse.next({ request: { headers } });
  }

  // 未验证会话时绝不透传客户端伪造的身份头。
  const headers = new Headers(request.headers);
  headers.delete("x-user-id");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/api/:path*"],
};
