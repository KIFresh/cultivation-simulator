import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/events/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    gameEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";

const mockFindMany = prisma.gameEvent.findMany as unknown as vi.Mock;
const mockCount = prisma.gameEvent.count as unknown as vi.Mock;
const mockRequireCultivator = requireCultivator as unknown as vi.Mock;

function makeReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

beforeEach(() => {
  vi.resetAllMocks();
});

it("未登录返回 401", async () => {
  mockRequireCultivator.mockResolvedValue({ error: new Response("Unauthorized", { status: 401 }) });
  const res = await GET(makeReq("/api/events"));
  expect(res.status).toBe(401);
});

it("已登录返回分页事件结构", async () => {
  mockRequireCultivator.mockResolvedValue({ cultivator: { id: "c1" } });
  mockFindMany.mockResolvedValue([{ id: "e1", title: "t", narrative: "n", createdAt: new Date() }]);
  mockCount.mockResolvedValue(1);

  const res = await GET(makeReq("/api/events?page=1&limit=20"));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.events).toHaveLength(1);
  expect(data.total).toBe(1);
  expect(data.hasMore).toBe(false);
});

it("分页参数边界处理", async () => {
  mockRequireCultivator.mockResolvedValue({ cultivator: { id: "c1" } });
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);

  const res = await GET(makeReq("/api/events?page=0&limit=200"));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.page).toBe(1);
  expect(data.limit).toBe(50);
});
