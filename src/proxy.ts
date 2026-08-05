import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Next 16 全局请求代理（取代 middleware.ts）。
 * 校验签名会话 cookie，向受信任的下游请求注入 `x-user-id` 头。
 * 各 API 路由通过 requireCultivator(request) 读取该头完成鉴权与所有权校验。
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionUserId = verifySession(token);
  const headers = new Headers(request.headers);
  const clientUserId = headers.get("x-user-id");

  if (sessionUserId) {
    headers.set("x-user-id", sessionUserId);
    return NextResponse.next({ request: { headers } });
  }

  if (clientUserId && /^[a-zA-Z0-9\-_]+$/.test(clientUserId)) {
    // 无有效会话时，允许携带格式合法的客户端身份头继续请求（由路由层 requireCultivator 决定是否接受）。
    return NextResponse.next({ request: { headers } });
  }

  headers.delete("x-user-id");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/api/:path*"],
};
