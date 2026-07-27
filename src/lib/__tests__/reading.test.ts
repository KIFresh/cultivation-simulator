import { describe, it, expect } from "vitest";
import {
  parseReadingLog,
  readBook,
  applyReadingResult,
  BOOK_POOL,
  type ReadingLog,
} from "@/lib/reading";

const baseLog: ReadingLog = { booksRead: 0, knowledge: 0, list: [] };

describe("parseReadingLog", () => {
  it("空值回零值", () => {
    expect(parseReadingLog(null)).toEqual(baseLog);
    expect(parseReadingLog("bad")).toEqual(baseLog);
  });
  it("解析已有记录", () => {
    const s = parseReadingLog(JSON.stringify({ booksRead: 5, knowledge: 5, list: [{ title: "x", domain: "y" }] }));
    expect(s.booksRead).toBe(5);
    expect(s.list.length).toBe(1);
  });
});

describe("readBook", () => {
  it("同种子可复现", () => {
    const a = readBook({ id: "r1", age: 10, log: baseLog });
    const b = readBook({ id: "r1", age: 10, log: baseLog });
    expect(a.book.id).toBe(b.book.id);
    expect(a.repeated).toBe(b.repeated);
  });
  it("已读过的书再读算复读（attrDelta 0）", () => {
    const first = readBook({ id: "r2", age: 10, log: baseLog });
    expect(first.attrDelta).toBe(1);
    // 全部读完后再读任意一本都算复读
    const fullLog: ReadingLog = {
      booksRead: BOOK_POOL.length,
      knowledge: BOOK_POOL.length,
      lastBook: BOOK_POOL[0].title,
      list: BOOK_POOL.map((b) => ({ title: b.title, domain: b.domain })),
    };
    const r = readBook({ id: "r3", age: 10, log: fullLog });
    expect(r.repeated).toBe(true);
    expect(r.attrDelta).toBe(0);
  });
});

describe("applyReadingResult", () => {
  it("累计统计并裁剪列表", () => {
    let log = baseLog;
    for (let i = 0; i < 25; i++) {
      const r = readBook({ id: `seed${i}`, age: 10, log });
      log = applyReadingResult(log, r);
    }
    expect(log.booksRead).toBe(25);
    expect(log.knowledge).toBe(25);
    expect(log.list.length).toBe(20); // 裁剪到 20
  });
});
