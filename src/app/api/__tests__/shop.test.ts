import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../shop/route";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    cultivator: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Mock shop items & realm utils
vi.mock("@/lib", () => ({
  getShopItems: vi.fn(),
  getItemById: vi.fn(),
  getRealmIndex: (r: string) =>
    ["凡人", "炼气期", "筑基期", "结丹期", "元婴期", "化神期"].indexOf(r),
  isRealmSufficient: (realm: string, minRealm: string) => {
    const order = ["凡人", "炼气期", "筑基期", "结丹期", "元婴期", "化神期"];
    const idx = order.indexOf(realm);
    const minIdx = order.indexOf(minRealm);
    if (minIdx < 0) return true;
    if (idx < 0) return false;
    return idx >= minIdx;
  },
}));

// Mock auth helpers
vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getShopItems, getItemById } from "@/lib";
import { requireCultivator } from "@/lib/auth-helpers";

const mockShopItems = vi.mocked(getShopItems);
const mockGetItemById = vi.mocked(getItemById);
const mockRequireCultivator = vi.mocked(requireCultivator);
const mockTransaction = vi.mocked(prisma.$transaction) as any;

const mockCultivator = {
  id: "c1",
  userId: "user1",
  gold: 100,
  name: "测试者",
  inventory: "[]",
  stamina: 80,
  age: 16,
  realm: "凡人",
  location: "home",
} as any;

const qiPillListing = {
  itemId: "qi_pill",
  price: 10,
  minRealm: undefined,
  item: {
    id: "qi_pill",
    name: "益气丹",
    icon: "💊",
    description: "补充灵气的基础丹药",
    effect: "修炼值+20",
  },
};

describe("Shop API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShopItems.mockReturnValue([qiPillListing]);
    mockGetItemById.mockReturnValue(qiPillListing.item);
    mockRequireCultivator.mockResolvedValue({ cultivator: mockCultivator });
    mockTransaction.mockImplementation(async (txn: any) => {
      if (typeof txn === "function") return txn();
      if (Array.isArray(txn)) return Promise.all(txn);
      return txn;
    });
  });

  describe("GET /api/shop", () => {
    it("返回普通商品列表（含锁定信息）", async () => {
      const req = new NextRequest(new URL("http://test/api/shop?realm=凡人"));
      const res = await GET(req);
      const data = await res.json();
      expect(data.items).toHaveLength(1);
      expect(data.items[0].itemId).toBe("qi_pill");
      expect(data.items[0].locked).toBe(false);
      expect(res.status).toBe(200);
    });

    it("坊市返回全部商品（越阶路径）", async () => {
      const req = new NextRequest(new URL("http://test/api/shop?location=market"));
      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it("境界不足的商品标注 locked", async () => {
      mockShopItems.mockReturnValue([
        qiPillListing,
        {
          itemId: "spirit_sword",
          price: 120,
          minRealm: "筑基期",
          item: { id: "spirit_sword", name: "灵剑", icon: "🗡️", description: "" },
        },
      ]);
      const req = new NextRequest(new URL("http://test/api/shop?realm=凡人"));
      const res = await GET(req);
      const data = await res.json();
      const locked = data.items.find((i: any) => i.locked === true);
      expect(locked).toBeDefined();
      expect(locked.lockReason).toContain("筑基期");
    });
  });

  describe("POST /api/shop", () => {
    it("成功购买", async () => {
      const updatedCultivator = {
        ...mockCultivator,
        gold: 90,
        inventory: JSON.stringify([{ itemId: "qi_pill", quantity: 1, equipped: false }]),
      };
      const mockUpdate = vi.fn().mockResolvedValue(updatedCultivator);
      vi.mocked(prisma.cultivator.update).mockImplementation(mockUpdate);
      vi.mocked(prisma.$transaction).mockImplementation(async (txn: any) => {
        if (Array.isArray(txn)) return Promise.all(txn);
        return txn;
      });

      const req = new NextRequest(new URL("http://test/api/shop"), {
        method: "POST",
        body: JSON.stringify({ itemId: "qi_pill", quantity: 1 }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.cultivator.gold).toBe(90);
      expect(data.item.name).toBe("益气丹");
    });

    it("金币不足时返回错误", async () => {
      mockRequireCultivator.mockResolvedValue({ cultivator: { ...mockCultivator, gold: 5 } });
      const req = new NextRequest(new URL("http://test/api/shop"), {
        method: "POST",
        body: JSON.stringify({ itemId: "qi_pill" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("金币不足");
    });

    it("商品不存在时返回错误", async () => {
      mockShopItems.mockReturnValue([]);
      const req = new NextRequest(new URL("http://test/api/shop"), {
        method: "POST",
        body: JSON.stringify({ itemId: "nonexistent" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("缺少必填参数返回错误", async () => {
      const req = new NextRequest(new URL("http://test/api/shop"), {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("未认证返回 401", async () => {
      mockRequireCultivator.mockResolvedValue({
        error: new Response(JSON.stringify({ error: "未认证" }), { status: 401 }),
      });
      const req = new NextRequest(new URL("http://test/api/shop"), {
        method: "POST",
        body: JSON.stringify({ itemId: "qi_pill" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("非法数量返回 400", async () => {
      const req = new NextRequest(new URL("http://test/api/shop"), {
        method: "POST",
        body: JSON.stringify({ itemId: "qi_pill", quantity: 0 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
