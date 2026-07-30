import crypto from "node:crypto";

/**
 * 无状态签名会话模块。
 *
 * 设计：token = base64url(userId) + "." + base64url(HMAC-SHA256(secret, payload))
 * - signSession(userId)：签发会话 token（供登录/注册成功后写入 HttpOnly cookie）
 * - verifySession(token)：验签并返回 userId，无效/缺失返回 null
 * - SESSION_COOKIE_NAME：会话 cookie 名（cs_session，HttpOnly）
 *
 * token 为客户端 cookie，登录时由 auto 路由重新签发，因此不依赖历史 token 兼容性。
 */

export const SESSION_COOKIE_NAME = "cs_session";

const SECRET = process.env.SESSION_SECRET || "cultivation-dev-secret-please-change-in-prod";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/** 为指定用户签发会话 token */
export function signSession(userId: string): string {
  const payload = b64url(Buffer.from(userId, "utf8"));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

/** 验签会话 token，成功返回 userId，失败/缺失返回 null */
export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts;
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return b64urlDecode(payload).toString("utf8");
  } catch {
    return null;
  }
}
