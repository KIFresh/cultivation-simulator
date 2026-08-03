import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  prisma: { memoryEntry: { findMany: mockFindMany } },
}));
vi.mock("@/lib/embedding", () => ({
  embedText: vi.fn().mockResolvedValue([]),
}));

import { retrieveRelevantMemories } from "../narrative-context";

const mk = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  cultivatorId: "c1",
  title: `标题${id}`,
  summary: `摘要${id}`,
  narrative: null,
  important: false,
  tags: "[]",
  embedding: null,
  createdAt: new Date(),
  cultivatorAge: 1,
  cultivatorRealm: "凡人",
  ...over,
});

describe("retrieveRelevantMemories - hot 层重要记忆保底", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("重要记忆（非最近）进入 hot 且带 ⭐，最近记忆补齐", async () => {
    // 模拟 orderBy createdAt desc：最新在前，born（重要）最旧在最后
    const entries = [];
    for (let i = 19; i >= 1; i--) entries.push(mk(`e${i}`));
    entries.push(mk("born", { important: true }));
    mockFindMany.mockResolvedValue(entries);

    const { hot } = await retrieveRelevantMemories("c1", "");
    expect(hot).toContain("⭐ 【标题born】摘要born");
    // 最近 4 条补齐（e19..e16，born 占 1 位）
    for (const i of [16, 17, 18, 19]) expect(hot).toContain(`【标题e${i}】摘要e${i}`);
    expect(hot).not.toContain("【标题e15】");
    // 最多 5 条
    expect(hot.split("\n").filter(Boolean)).toHaveLength(5);
  });

  it("重要记忆超过 2 条时只保底 2 条", async () => {
    // 日常最新在前，3 条 important 全在末尾（最旧）
    const entries = [];
    for (let i = 0; i < 10; i++) entries.push(mk(`n${i}`));
    entries.push(mk("a", { important: true }), mk("b", { important: true }), mk("c", { important: true }));
    mockFindMany.mockResolvedValue(entries);

    const { hot } = await retrieveRelevantMemories("c1", "");
    const stars = (hot.match(/⭐/g) ?? []).length;
    expect(stars).toBe(2);
  });

  it("重要记忆与最近重叠时去重不超 5 条", async () => {
    const entries = [];
    for (let i = 0; i < 5; i++) entries.push(mk(`r${i}`, { important: i === 4 }));
    mockFindMany.mockResolvedValue(entries);

    const { hot } = await retrieveRelevantMemories("c1", "");
    expect(hot.split("\n").filter(Boolean)).toHaveLength(5);
    expect(hot).toContain("⭐ ");
  });

  it("无记忆时返回空", async () => {
    mockFindMany.mockResolvedValue([]);
    const r = await retrieveRelevantMemories("c1", "");
    expect(r).toEqual({ hot: "", relevant: "", early: "" });
  });
});
