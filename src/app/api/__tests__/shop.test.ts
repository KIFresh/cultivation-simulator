import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../shop/route';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    cultivator: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Mock shop items
vi.mock('@/lib', () => ({
  getShopItems: vi.fn(),
  getItemById: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { getShopItems, getItemById } from '@/lib';

const mockShopItems = vi.mocked(getShopItems);
const mockGetItemById = vi.mocked(getItemById);
const mockFindUnique = vi.mocked(prisma.user.findUnique) as any;
const mockTransaction = vi.mocked(prisma.$transaction) as any;

const mockCultivator = {
  id: 'c1', userId: 'user1', gold: 100, name: '测试者',
  inventory: '[]', stamina: 80, age: 16,
} as any;

const qiPillListing = {
  itemId: 'qi_pill', price: 10, currency: 'gold',
  item: { id: 'qi_pill', name: '益气丹', icon: '💊', category: 'pill', description: '补充灵气的基础丹药', effect: '修炼值+20' },
};

describe('Shop API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShopItems.mockReturnValue([qiPillListing]);
    mockGetItemById.mockReturnValue(qiPillListing.item);
    mockFindUnique.mockResolvedValue({ id: 'user1', cultivator: mockCultivator });
    mockTransaction.mockImplementation(async (txn: any) => {
      if (typeof txn === 'function') return txn();
      if (Array.isArray(txn)) return Promise.all(txn);
      return txn;
    });
  });

  describe('GET /api/shop', () => {
    it('返回普通商品列表', async () => {
      const req = new NextRequest(new URL('http://test/api/shop?realm=凡人'));
      const res = await GET(req);
      const data = await res.json();
      expect(data.items).toEqual([qiPillListing]);
      expect(res.status).toBe(200);
    });

    it('坊市返回全部商品（越阶路径）', async () => {
      const req = new NextRequest(new URL('http://test/api/shop?location=market'));
      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  describe('POST /api/shop', () => {
    it('成功购买', async () => {
      const updatedCultivator = { ...mockCultivator, gold: 90, inventory: JSON.stringify([{ itemId: 'qi_pill', quantity: 1, equipped: false }]) };
      const mockUpdate = vi.fn().mockResolvedValue(updatedCultivator);
      const mockPrisma = { user: { findUnique: vi.fn().mockResolvedValue({ id: 'user1', cultivator: mockCultivator }) }, cultivator: { update: mockUpdate }, $transaction: vi.fn() };
      // Re-mock for this test
      vi.mocked(prisma.cultivator.update).mockImplementation(mockUpdate);
      vi.mocked(prisma.$transaction).mockImplementation(async (txn: any) => {
        if (Array.isArray(txn)) return Promise.all(txn);
        return txn;
      });

      const req = new NextRequest(new URL('http://test/api/shop'), {
        method: 'POST',
        body: JSON.stringify({ userId: 'user1', itemId: 'qi_pill', quantity: 1 }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.cultivator.gold).toBe(90);
      expect(data.item.name).toBe('益气丹');
    });

    it('金币不足时返回错误', async () => {
      mockFindUnique.mockResolvedValue({ id: 'user1', cultivator: { ...mockCultivator, gold: 5 } });
      const req = new NextRequest(new URL('http://test/api/shop'), {
        method: 'POST',
        body: JSON.stringify({ userId: 'user1', itemId: 'qi_pill' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('金币不足');
    });

    it('商品不存在时返回错误', async () => {
      mockShopItems.mockReturnValue([]);
      const req = new NextRequest(new URL('http://test/api/shop'), {
        method: 'POST',
        body: JSON.stringify({ userId: 'user1', itemId: 'nonexistent' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('缺少必填参数返回错误', async () => {
      const req = new NextRequest(new URL('http://test/api/shop'), {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});