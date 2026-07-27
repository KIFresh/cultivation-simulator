import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";

interface Book {
  id: string;
  title: string;
  author: string;
  attr: string;
  gain: number;
  staminaCost: number;
  desc: string;
}

const BOOKS: Book[] = [
  { id: "qigong_basics", title: "《吐纳真解》", author: "玄机子", attr: "spirit", gain: 3, staminaCost: 4, desc: "入门吐纳之法，固本培元。" },
  { id: "root_treatise", title: "《根骨论》", author: "药王谷", attr: "root", gain: 3, staminaCost: 5, desc: "论述资质根源，增益根骨。" },
  { id: "insight_sutra", title: "《悟道箓》", author: "无名道人", attr: "insight", gain: 3, staminaCost: 5, desc: "参悟天道，提升悟性。" },
  { id: "beast_almanac", title: "《灵兽志》", author: "御兽门", attr: "mind", gain: 2, staminaCost: 4, desc: "记载灵兽习性，磨炼心性。" },
];

interface ReadingEntry {
  bookId: string;
  title: string;
  finishedAt: string;
}

function parseLog(raw: string | null): ReadingEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as ReadingEntry[]) : [];
  } catch {
    return [];
  }
}

// GET — 当前书单与已读记录
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    return NextResponse.json({ readingLog: parseLog(cultivator.readingLog), availableBooks: BOOKS });
  } catch (error) {
    console.error("获取书单失败:", error);
    return NextResponse.json({ error: "获取书单失败" }, { status: 500 });
  }
}

// POST — 研读一本书
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const book = BOOKS.find((b) => b.id === body?.bookId);
    if (!book) {
      return NextResponse.json({ error: "未找到该书" }, { status: 404 });
    }
    if (cultivator.stamina < book.staminaCost) {
      return NextResponse.json({ error: "体力不足，无法研读" }, { status: 400 });
    }

    let attrs: Record<string, number> = {};
    if (cultivator.attributes) {
      try {
        attrs = JSON.parse(cultivator.attributes);
      } catch {
        attrs = {};
      }
    }
    const before = attrs[book.attr] ?? 0;
    attrs[book.attr] = before + book.gain;

    const log = parseLog(cultivator.readingLog);
    log.push({ bookId: book.id, title: book.title, finishedAt: new Date().toISOString() });

    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: {
        attributes: JSON.stringify(attrs),
        stamina: cultivator.stamina - book.staminaCost,
        readingLog: JSON.stringify(log),
      },
    });

    return NextResponse.json({
      success: true,
      book,
      gain: { attr: book.attr, before, after: attrs[book.attr] },
      stamina: updated.stamina,
      readingLog: log,
    });
  } catch (error) {
    console.error("研读失败:", error);
    return NextResponse.json({ error: "研读失败" }, { status: 500 });
  }
}
