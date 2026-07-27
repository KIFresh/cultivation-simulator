import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// ── Mock prisma（覆盖 resolve-event 用到的 surface）──────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cultivator: { update: vi.fn() },
    familyMember: { findMany: vi.fn(), update: vi.fn() },
    gameEvent: { create: vi.fn() },
  },
}));

// ── Mock auth-helpers（requireCultivator）────────
vi.mock('@/lib/auth-helpers', () => ({
  requireCultivator: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCultivator } from '@/lib/auth-helpers';

const mockUpdate = vi.mocked(prisma.cultivator.update) as any;
const mockFindMany = vi.mocked(prisma.familyMember.findMany) as any;
const mockRequire = vi.mocked(requireCultivator) as any;

// ── 基础修炼者数据（含凡人经济自循环所需的 gold 字段）──────
const baseCultivator = {
  id: 'c1',
  attributes: JSON.stringify({ root: 10, spirit: 8, insight: 6, luck: 5, charm: 4, mind: 7 }),
  health: 100,
  gold: 100,
} as any;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://test/api/resolve-event'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('resolve-event 金币结算（凡人经济自循环）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // update 把写入的 data 合并回 baseCultivator，便于断言返回值
    mockUpdate.mockImplementation((args: any) =>
      Promise.resolve({ ...baseCultivator, ...(args.data || {}) }),
    );
    mockFindMany.mockResolvedValue([]);
    mockRequire.mockResolvedValue({ cultivator: baseCultivator });
  });

  it('来源选项 f_newyear 红包 gold:+20 正确增加金币', async () => {
    baseCultivator.gold = 100;
    const res = await POST(makeRequest({ userId: 'u1', eventId: 'f_newyear', optionIndex: 0 }));
    const json = await res.json();
    expect(mockUpdate).toHaveBeenCalled();
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.gold).toBe(120);
    expect(json.cultivator.gold).toBe(120);
  });

  it('sink 选项 m_rain_book gold:-3 且余额不足时 clamp 到 0', async () => {
    baseCultivator.gold = 2;
    const res = await POST(makeRequest({ userId: 'u1', eventId: 'm_rain_book', optionIndex: 0 }));
    const json = await res.json();
    expect(json.cultivator.gold).toBe(0);
  });

  it('无 gold 选项（d_praise）不改变金币', async () => {
    baseCultivator.gold = 50;
    const res = await POST(makeRequest({ userId: 'u1', eventId: 'd_praise', optionIndex: 0 }));
    const json = await res.json();
    expect(json.cultivator.gold).toBe(50);
  });
});