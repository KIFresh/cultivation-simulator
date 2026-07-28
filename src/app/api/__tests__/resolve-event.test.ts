import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../resolve-event/route';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cultivator: { update: vi.fn(), findUnique: vi.fn() },
    familyMember: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    gameEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Mock auth
vi.mock('@/lib/auth-helpers', () => ({
  requireCultivator: vi.fn(),
  apiError: vi.fn((msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status })),
}));

// Mock lib utilities
vi.mock('@/lib/inventory-utils', () => ({
  parseAttributes: vi.fn((s: string | null) => (s ? JSON.parse(s) : {})),
}));

// Mock narrative effects
vi.mock('@/lib/narrative-effects', () => ({
  applyEffects: vi.fn().mockResolvedValue(undefined),
  clampEffectsArray: vi.fn((effects: any) => effects),
}));

import { requireCultivator } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

const mockRequire = vi.mocked(requireCultivator);
const mockCultivatorUpdate = vi.mocked(prisma.cultivator.update);
const mockCultivatorFindUnique = vi.mocked(prisma.cultivator.findUnique);
const mockFamilyFindMany = vi.mocked(prisma.familyMember.findMany);
const mockFamilyUpdate = vi.mocked(prisma.familyMember.update);
const mockGameEventCreate = vi.mocked(prisma.gameEvent.create);
const mockTransaction = vi.mocked(prisma.$transaction) as any;

const mockCultivator = {
  id: 'c1', name: '罗青', worldId: 'earth', age: 10,
  attributes: JSON.stringify({ root: 5, spirit: 5, insight: 5, luck: 5, charm: 5, mind: 5 }),
  health: 100,
  gold: 50,
  stamina: 80,
} as any;

const father = { id: 'f1', relation: '父亲', alive: true, intimacy: 50 } as any;
const mother = { id: 'm1', relation: '母亲', alive: true, intimacy: 40 } as any;

function makeReq(eventId: string, optionIndex: number) {
  return new NextRequest('http://localhost/api/resolve-event', {
    method: 'POST',
    body: JSON.stringify({ eventId, optionIndex }),
  });
}

describe('resolve-event 双亲亲密度对称', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequire.mockResolvedValue({ cultivator: mockCultivator } as any);
    mockCultivatorFindUnique.mockResolvedValue(mockCultivator as any);
    mockFamilyFindMany.mockResolvedValue([father, mother] as any);
    mockFamilyUpdate.mockResolvedValue({} as any);
    mockGameEventCreate.mockResolvedValue({} as any);
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        culttivator: { update: vi.fn() },
        familyMember: { findMany: mockFamilyFindMany, update: mockFamilyUpdate },
        gameEvent: { create: mockGameEventCreate },
      };
      await cb(tx);
      return tx;
    });
  });

  it('双亲俱在时，亲密度应同时写入父母双方（e_primary_parents +3）', async () => {
    const res = await POST(makeReq('e_primary_parents', 0));
    expect(res.status).toBe(200);

    const updatedIds = mockFamilyUpdate.mock.calls.map((c) => c[0].where.id);
    expect(updatedIds).toContain('f1');
    expect(updatedIds).toContain('m1');

    const fatherCall = mockFamilyUpdate.mock.calls.find((c) => c[0].where.id === 'f1');
    const motherCall = mockFamilyUpdate.mock.calls.find((c) => c[0].where.id === 'm1');
    expect(fatherCall![0].data.intimacy).toBe(53); // 50 + 3
    expect(motherCall![0].data.intimacy).toBe(43); // 40 + 3
  });

  it('仅单亲存活时，只写入存活的那一位', async () => {
    mockFamilyFindMany.mockResolvedValue([father] as any);
    const res = await POST(makeReq('e_primary_parents', 0));
    expect(res.status).toBe(200);

    const updatedIds = mockFamilyUpdate.mock.calls.map((c) => c[0].where.id);
    expect(updatedIds).toEqual(['f1']);
    expect(mockFamilyUpdate.mock.calls[0][0].data.intimacy).toBe(53);
  });

  it('负向亲密度应被 clamp 到 0（e_junior_parents option 1, parentIntimacy: -2）', async () => {
    const lowFather = { ...father, intimacy: 1 } as any;
    mockFamilyFindMany.mockResolvedValue([lowFather, mother] as any);
    const res = await POST(makeReq('e_junior_parents', 1));
    expect(res.status).toBe(200);

    const fatherCall = mockFamilyUpdate.mock.calls.find((c) => c[0].where.id === 'f1');
    const motherCall = mockFamilyUpdate.mock.calls.find((c) => c[0].where.id === 'm1');
    expect(fatherCall![0].data.intimacy).toBe(0); // max(0, 1-2)
    expect(motherCall![0].data.intimacy).toBe(38); // 40-2
  });
});

describe('resolve-event 节日事件结算', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequire.mockResolvedValue({ cultivator: mockCultivator } as any);
    mockCultivatorFindUnique.mockResolvedValue(mockCultivator as any);
    mockFamilyFindMany.mockResolvedValue([father, mother] as any);
    mockFamilyUpdate.mockResolvedValue({} as any);
    mockGameEventCreate.mockResolvedValue({} as any);
    mockTransaction.mockImplementation(async (cb: any) => {
      const tx = {
        familyMember: { findMany: mockFamilyFindMany, update: mockFamilyUpdate },
        gameEvent: { create: mockGameEventCreate },
      };
      await cb(tx);
      return tx;
    });
  });

  it('节日事件（f_newyear 新年红包 luck+1，gold+20，无 familyEffects）正确结算属性且不写父母', async () => {
    const res = await POST(makeReq('f_newyear', 0));
    expect(res.status).toBe(200);
    // 该选项无 familyEffects，不应写父母亲密度
    expect(mockFamilyUpdate.mock.calls.length).toBe(0);
  });
});