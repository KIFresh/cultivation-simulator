import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================
// 属性验证（服务端）
// ============================================================

const VALID_ATTR_KEYS = new Set(["root", "spirit", "insight", "luck", "charm", "mind"]);
const MAX_ATTR_VALUE = 50;

/**
 * 校验并清理属性对象，防止恶意客户端提交非法属性值
 * @returns 清理后的属性对象，或 null（格式非法时）
 */
export function sanitizeAttributes(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_ATTR_KEYS.has(key)) continue; // 忽略未知属性
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > MAX_ATTR_VALUE) return null; // 非法值则整体拒绝
    result[key] = Math.round(num * 10) / 10; // 保留一位小数
  }
  // 允许空对象（表示无属性数据）
  return result;
}
