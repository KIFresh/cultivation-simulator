import crypto from "node:crypto";

/**
 * 使用 scrypt 加盐哈希密码
 * 存储格式：salt:hash（64字节 scrypt 哈希的 hex 字符串）
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(password, s, 64).toString("hex");
  return { hash: h, salt: s };
}