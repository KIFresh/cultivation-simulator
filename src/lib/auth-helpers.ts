import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── CUID 格式校验 ──────────────────────────────────────────
// Prisma 默认用 cuid() 生成 ID，格式如 "clx3abc..."
const CUID_RE = /^c[a-z0-9]{24,}$/;

export function isValidUserId(id: unknown): id is string {
  return typeof id === "string" && CUID_RE.test(id);
}

// ── 统一错误响应 ──────────────────────────────────────────
export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status },
  );
}

// ── 安全解析 JSON body ────────────────────────────────────
export async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
    return null;
  } catch {
    return null;
  }
}

// ── 必填字段校验 ──────────────────────────────────────────
export function requireFields(
  body: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === "") {
      return `缺少必填参数: ${f}`;
    }
  }
  return null;
}

// ── 安全字符串：trim + 长度限制 ───────────────────────────
export function sanitizeString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

// ── 整数范围校验 ──────────────────────────────────────────
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// ── 核心：获取修炼者（带所有权校验）──────────────────────
export interface CultivatorWithUser {
  id: string;
  userId: string;
  name: string;
  stamina: number;
  realm: string;
  realmLevel: number;
  gold: number;
  worldId: string | null;
  age: number;
  quarter: number;
  worldYear: number;
  quarterAccum: string | null;
  location: string | null;
  attributes: string | null;
  attributeExp: string | null;
  subjectExp: string | null;
  inventory: string | null;
  npcRelations: string | null;
  storyEntries: string | null;
  storyEntriesUpdatedAt: Date | null;
  talents: string | null;
  inheritedTalent: string | null;
  inheritedItems: string | null;
  spiritualRoot: string;
  title: string | null;
  maxAge: number | null;
  bonusAge: number;
  breakthroughCount: number;
  breakthroughBuff: number;
  reincarnationCount: number;
  injuryDebuff: number;
  mindDemon: number;
  occupation: string | null;
  physique: string | null;
  fate: string | null;
  schoolRank: number;
  personality: string | null;
  clique: string | null;
  examResults: string | null;
  milestones: string | null;
  pet: string | null;
  classEnroll: string | null;
  savings: number | null;
  arcadeStats: string | null;
  readingLog: string | null;
  unlockedLocations: string | null;
  unlockedFormulas: string | null;
  toxicity: number;
    health: number;
      furnaceEquipped: string | null;
      properties: string | null;
    cultivationExp: number;
  totalExp: number;
}

export async function requireCultivator(
  request: NextRequest,
): Promise<{ error: NextResponse } | { cultivator: CultivatorWithUser }> {
  // 身份只信任 proxy.ts 注入的 x-user-id（由签名会话 cookie 验证），
  // 不再信任请求体/查询参数中的 userId（CUID 可枚举）。
  const userId = request.headers.get("x-user-id");
  if (!userId || !isValidUserId(userId)) {
    return { error: apiError("未登录或会话无效", 401, "AUTH_REQUIRED") };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { cultivator: true },
  });

  if (!user?.cultivator) {
    return { error: apiError("请先创建修炼者", 404, "NO_CULTIVATOR") };
  }

  return { cultivator: user.cultivator as CultivatorWithUser };
}

// ── SSRF 防护：禁止内网地址 ────────────────────────────────
function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  // fc00::/7 (ULA) and fe80::/10 (link-local)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized) || /^fe[89ab][0-9a-f]:/i.test(normalized)) return true;
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4[1]) : false;
}

/** 拒绝本机、私网、链路本地和 IPv4-mapped IPv6 主机。 */
export function isPrivateOrLocalHostname(rawHostname: string): boolean {
  const hostname = rawHostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  return isPrivateIpv4(hostname) || isPrivateIpv6(hostname);
}

/**
 * 拒绝本机、私网、链路本地和 IPv4-mapped IPv6 地址。
 * URL 会规范化 2130706433、127.1 等数字 IPv4 写法，再检查 hostname。
 */
export function isPrivateOrLocalUrl(rawUrl: string): boolean {
  try {
    return isPrivateOrLocalHostname(new URL(rawUrl.trim()).hostname);
  } catch {
    // 无效 URL 会由调用方报告格式错误；这里不作为私网地址处理。
    return false;
  }
}

// ── 管理员鉴权 ────────────────────────────────────────────
export function requireAdminKey(providedKey: unknown): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return false; // 未配置 = 禁止
  if (typeof providedKey !== "string") return false;
  // 常量时间比较防时序攻击
  if (providedKey.length !== adminKey.length) return false;
  const a = Buffer.from(providedKey);
  const b = Buffer.from(adminKey);
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

// ── 安全 JSON.parse ───────────────────────────────────────
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
