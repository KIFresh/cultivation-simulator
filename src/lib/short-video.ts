// 短视频奇遇：指尖滑过，都市修仙的碎片落进心里。
// 复用 weather 模块的 BoonEntry 类型作为收藏条目。

import type { BoonEntry } from "@/lib/weather";
import { safeJsonParse } from "./json-helper";

export interface ShortVideo {
  id: string;
  title: string;
  tag: string;
  mood: string;
}

export const SHORT_VIDEO_POOL: ShortVideo[] = [
  { id: "sv_cultivator", title: "凌晨四点的炼丹直播", tag: "修仙日常", mood: "奋斗" },
  { id: "sv_pet", title: "我家灵宠成精了", tag: "灵宠", mood: "治愈" },
  { id: "sv_market", title: "菜市场里的隐世高手", tag: "市井", mood: "诙谐" },
  { id: "sv_secret", title: "城郊秘境探险实录", tag: "秘境", mood: "刺激" },
  { id: "sv_food", title: "灵厨的一碗面", tag: "美食", mood: "治愈" },
  { id: "sv_sword", title: "剑修的午后对练", tag: "武学", mood: "燃" },
];

/** 本地收藏键（与历史实现保持一致）。 */
export function favoriteKey(id: string): string {
  return `short-video-favs:${id}`;
}

/** 按种子挑一个短视频，并附一句感悟。 */
export function pickShortVideo(seed: string): { video: ShortVideo; reflection: string } {
  const idx = Math.abs(hashCode(seed)) % SHORT_VIDEO_POOL.length;
  const video = SHORT_VIDEO_POOL[idx];
  return { video, reflection: `刷到「${video.title}」，你若有所思。` };
}

export function getShortVideoFavorites(id: string): ShortVideo[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(favoriteKey(id));
    if (!raw) return [];
    const parsed: unknown = safeJsonParse(raw, []);
    if (Array.isArray(parsed)) return parsed as ShortVideo[];
  } catch {
    // ignore
  }
  return [];
}

export function toggleShortVideoFavorite(id: string, video: ShortVideo): ShortVideo[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const current = getShortVideoFavorites(id);
  const exists = current.some((v) => v.id === video.id);
  const next = exists ? current.filter((v) => v.id !== video.id) : [...current, video];
  try {
    window.localStorage.setItem(favoriteKey(id), JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

// 短视频机缘收藏（与 streets / weather 的 BoonEntry 同源结构）
export function saveShortVideoBoon(id: string, boon: BoonEntry): BoonEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const key = `short-video-boons:${id}`;
  let list: BoonEntry[] = [];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) list = safeJsonParse(raw, [] as BoonEntry[]);
  } catch {
    list = [];
  }
  const next = [...list, boon].slice(-50);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}
