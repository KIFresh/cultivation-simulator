import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  gameEvent: { count: vi.fn(), create: vi.fn() },
  cultivatorTechnique: { findMany: vi.fn() },
  cultivator: { update: vi.fn() },
  $transaction: vi.fn((cb: any) => cb({
    cultivator: { update: vi.fn() },
    gameEvent: { create: vi.fn() },
  })),
}));

const mockResolveCombat = vi.hoisted(() => vi.fn());
const mockRequireCultivator = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/combat-engine', () => ({ resolveCombat: mockResolveCombat }));
vi.mock('@/lib/auth-helpers', () => ({ requireCultivator: mockRequireCultivator }));
vi.mock('@/lib/narrative-effects', () => ({
  applyEffects: vi.fn().mockResolvedValue(undefined),
  clampEffectsArray: vi.fn((effects: any) => effects),
}));

const makeCultivator = (overrides: any = {}) => ({
  id: 'c1', userId: 'u1', name: '测试', realm: '炼气期', realmLevel: 1,
  stamina: 50, gold: 100, inventory: '[]', age: 18, location: 'home',
  cultivationExp: 100, totalExp: 200, spiritualRoot: '火灵根',
  breakthroughCount: 0, breakthroughBuff: 0, reincarnationCount: 0,
  injuryDebuff: 0, mindDemon: 0, maxAge: 80, talents: null,
  inheritedTalent: null, inheritedItems: null, storyEntries: '[]',
  bonusAge: 0, attributes: null, ...overrides,
});

const makeRequest = (body: any): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

describe('Combat API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
    mockPrisma.gameEvent.count.mockResolvedValue(0);
    mockPrisma.cultivatorTechnique.findMany.mockResolvedValue([]);
    mockResolveCombat.mockResolvedValue({
      win: true, style: '碾压', narrative: '轻松击败敌人',
      loot: { gold: 20, exp: 30, items: [] },
      enemy: { id: 'e1', name: '山贼' },
    });
  });

  it('未认证返回 401', async () => {
    mockRequireCultivator.mockResolvedValue({ error: new Response(JSON.stringify({ error: "未认证" }), { status: 401 }) });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('无 cultivator 返回 401', async () => {
    mockRequireCultivator.mockResolvedValue({ error: new Response(JSON.stringify({ error: "未认证" }), { status: 401 }) });
    const res = await POST(makeRequest({ enemyId: 'e1' }));
    expect(res.status).toBe(401);
  });

  it('每日战斗次数超过上限返回 400', async () => {
    mockPrisma.gameEvent.count.mockResolvedValue(5);
    const res = await POST(makeRequest({ enemyId: 'e1' }));
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.error).toContain('上限');
  });

  it('战斗胜利返回结果并更新修炼者', async () => {
    const res = await POST(makeRequest({ enemyId: 'e1', locationId: 'forest' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.win).toBe(true);
    expect(d.loot.gold).toBe(20);
  });

  it('战斗失败扣除金币和寿元', async () => {
    mockResolveCombat.mockResolvedValue({
      win: false, style: '惨败', narrative: '不敌对手',
      penalty: { goldLoss: 10, injuryDebuff: 1, lifespanLoss: 2 },
      enemy: { id: 'e1', name: '山贼' },
    });
    const res = await POST(makeRequest({ enemyId: 'e1' }));
    const d = await res.json();
    expect(d.win).toBe(false);
  });
});