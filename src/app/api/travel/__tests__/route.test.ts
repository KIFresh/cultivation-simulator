import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  cultivator: { update: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/cultivation-data', () => ({
  calcTravelCostByMode: vi.fn((from, to, mode: string) => {
    const costs: Record<string, { staminaCost: number; goldCost: number }> = {
      walk: { staminaCost: 3, goldCost: 0 },
      car: { staminaCost: 1, goldCost: 6 },
      bus: { staminaCost: 2, goldCost: 3 },
      taxi: { staminaCost: 1, goldCost: 9 },
    };
    return costs[mode] || { staminaCost: 3, goldCost: 0 };
  }),
}));

const makeRequest = (body: any): NextRequest =>
  ({ json: () => Promise.resolve(body) }) as unknown as NextRequest;

const makeCultivator = (overrides: any = {}) => ({
  id: 'c1', name: '测试', realm: '炼气期',
  stamina: 20, gold: 50, age: 18, location: 'home',
  worldId: 'earth', inventory: '[]',
  ...overrides,
});

describe('Travel API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: makeCultivator() });
    mockPrisma.cultivator.update.mockResolvedValue(makeCultivator({ location: 'school' }));
  });

  it('缺少目的地时返回400', async () => {
    const res = await POST(makeRequest({ userId: 'u1' }));
    expect(res.status).toBe(400);
  });

  it('步行：消耗体力，不消耗金币', async () => {
    const res = await POST(makeRequest({ userId: 'u1', locationId: 'school', travelMode: 'walk' }));
    const data = await res.json();
    expect(data.travelMode).toBe('walk');
    expect(data.staminaCost).toBe(3);
    expect(data.goldCost).toBe(0);
  });

  it('开车：消耗金币', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: makeCultivator({ inventory: JSON.stringify([{ itemId: 'car', quantity: 1 }]) }) });
    const res = await POST(makeRequest({ userId: 'u1', locationId: 'school', travelMode: 'car' }));
    const data = await res.json();
    expect(data.travelMode).toBe('car');
    expect(data.goldCost).toBeGreaterThan(0);
  });

  it('打车：消耗金币', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: makeCultivator({ inventory: JSON.stringify([{ itemId: 'phone', quantity: 1 }]) }) });
    const res = await POST(makeRequest({ userId: 'u1', locationId: 'school', travelMode: 'taxi' }));
    const data = await res.json();
    expect(data.travelMode).toBe('taxi');
    expect(data.goldCost).toBeGreaterThan(0);
  });

  it('体力不足时返回400', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: makeCultivator({ stamina: 1 }) });
    const res = await POST(makeRequest({ userId: 'u1', locationId: 'school', travelMode: 'walk' }));
    expect(res.status).toBe(400);
  });

  it('公共交通：消耗体力+金币', async () => {
    const res = await POST(makeRequest({ userId: 'u1', locationId: 'school', travelMode: 'bus' }));
    const data = await res.json();
    expect(data.travelMode).toBe('bus');
    expect(data.staminaCost).toBe(2);
    expect(data.goldCost).toBe(3);
  });
});