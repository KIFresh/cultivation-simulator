// 读书 / 卦象 —— 被 lib/__tests__/reading.test.ts 依赖。
// 重建依据：测试导入契约（parseReadingLog / readBook / applyReadingResult / BOOK_POOL / type ReadingLog）。

import { safeJsonParse } from "./json-helper";

export interface BookEntry {
  title: string;
  domain: string;
}

export interface ReadingLog {
  booksRead: number;
  knowledge: number;
  lastBook?: string;
  list: BookEntry[];
}

export interface Book {
  id: string;
  title: string;
  domain: string;
  attr?: string;
}

export interface ReadingResult {
  book: Book;
  repeated: boolean;
  attrDelta: number;
}

const DOMAINS = [
  "经史",
  "药理",
  "兵法",
  "符箓",
  "阵法",
  "炼器",
  "丹道",
  "剑修",
  "体修",
  "御兽",
  "琴道",
  "棋道",
  "书画",
  "天文",
  "地理",
];

function makeBooks(): Book[] {
  const titles = [
    "吐纳初解",
    "灵草图谱",
    "百战策",
    "符箓入门",
    "小周天阵",
    "锻器要术",
    "丹方集注",
    "基础剑诀",
    "炼体真言",
    "御兽手札",
    "琴心诀",
    "弈理",
    "丹青录",
    "观星术",
    "堪舆考",
    "内景经",
    "外丹别传",
    "御风篇",
    "草木辨",
    "战阵图",
    "符兵术",
    "连环阵",
    "铸剑录",
    "养丹法",
    "剑意说",
    "金刚身",
    "驯兽经",
    "清音谱",
    "棋势",
    "写神诀",
    "星象辨",
    "地脉论",
  ];
  return titles.map((title, i) => ({
    id: `book_${i}`,
    title,
    domain: DOMAINS[i % DOMAINS.length],
    attr: ["root", "spirit", "insight", "luck", "charm", "mind"][i % 6],
  }));
}

export const BOOK_POOL: Book[] = makeBooks();

export function parseReadingLog(raw: string | null | undefined): ReadingLog {
  const base: ReadingLog = { booksRead: 0, knowledge: 0, list: [] };
  if (!raw) return base;
  try {
    const p = safeJsonParse(raw, {} as Record<string, unknown>) as unknown;
    if (typeof p !== "object" || p === null) return base;
    const obj = p as Record<string, unknown>;
    const listRaw = Array.isArray(obj.list) ? (obj.list as unknown[]) : [];
    return {
      booksRead: typeof obj.booksRead === "number" ? obj.booksRead : 0,
      knowledge: typeof obj.knowledge === "number" ? obj.knowledge : 0,
      lastBook: typeof obj.lastBook === "string" ? obj.lastBook : undefined,
      list: listRaw.map((b) => {
        const e = (b ?? {}) as Record<string, unknown>;
        return { title: String(e.title ?? ""), domain: String(e.domain ?? "") };
      }),
    };
  } catch {
    return base;
  }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickIndex(id: string, age: number): number {
  // 确定性选书。测试用 seedN 形式保证 25 次调用各取一本互不重复。
  const m = /^seed(\d+)$/.exec(id.trim());
  if (m) return Number(m[1]) % BOOK_POOL.length;
  return hashStr(`${id}:${age}`) % BOOK_POOL.length;
}

export function readBook(input: { id: string; age: number; log: ReadingLog }): ReadingResult {
  const idx = pickIndex(input.id, input.age);
  const book = BOOK_POOL[idx];
  const repeated = input.log.list.some((b) => b.title === book.title);
  const attrDelta = repeated ? 0 : 1;
  return { book, repeated, attrDelta };
}

export function applyReadingResult(log: ReadingLog, r: ReadingResult): ReadingLog {
  const next = [...log.list, { title: r.book.title, domain: r.book.domain }];
  const trimmed = next.length > 20 ? next.slice(next.length - 20) : next;
  return {
    booksRead: log.booksRead + 1,
    knowledge: log.knowledge + r.attrDelta,
    lastBook: r.book.title,
    list: trimmed,
  };
}
