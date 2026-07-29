import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  cultivator: { update: vi.fn() },
  cultivatorTechnique: { findFirst: vi.fn(), create: vi.fn() },
}));

const mockGetItemById = vi.hoisted(() => vi.fn());
const mockTechniques = vi.hoisted(() => ({}));
const mockRequireCultivator = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth-helpers', () => ({ requireCultivator: mockRequireCultivator }));
vi.mock('@/lib', () => ({
  getItemById: mockGetItemById,
  TECHNIQUES: mockTechniques,
}));

const makeCultivator = (overrides: any = {}) => ({
  id: 'c1', userId: 'u1', name: '测试', realm: '炼气期', realmLevel: 1,
  stamina: 50, gold: 100, inventory: '[]', age: 18, location: 'home',
  cultivationExp: 100, totalExp: 200, spiritualRoot: '火灵根',
  breakthroughCount: 0, breakthroughBuff: 0, reincarnationCount: 0,
  injuryDebuff: 0, mindDemon: 0, maxAge: null, bonusAge: 0,
  talents: null, inheritedTalent: null, inheritedItems: null,
  attributes: null, ...overrides,
});

const makeRequest = (body: any): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

describe('Cultivator UseItem API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: makeCultivator() });
  });

  it('缺少 itemId 返回 400', async () => {
    const res = await POST(makeRequest({ itemId: 'pill' }));
    expect(res.status).toBe(400);
  });

  it('无认证返回 401', async () => {
    mockRequireCultivator.mockResolvedValueOnce({ error: { status: 401 } as NextResponse });
    const res = await POST(makeRequest({ itemId: 'pill' }));
    expect(res.status).toBe(401);
  });

  it('物品不存在返回 400', async () => {
    mockGetItemById.mockReturnValue(undefined);
    const res = await POST(makeRequest({ userId: 'u1', itemId: 'unknown' }));
    expect(res.status).toBe(400);
  });

  it('物品没有 useEffect 返回 400', async () => {
    mockGetItemById.mockReturnValue({ id: 'stone', name: '石头', useEffect: null });
    const res = await POST(makeRequest({ userId: 'u1', itemId: 'stone' }));
    expect(res.status).toBe(400);
  });

  it('背包无该物品返回 400', async () => {
    mockGetItemById.mockReturnValue({ id: 'pill', name: '丹药', useEffect: { type: 'recoverStamina', value: 20 } });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: makeCultivator({ inventory: '[]' }) });
    const res = await POST(makeRequest({ userId: 'u1', itemId: 'pill' }));
    expect(res.status).toBe(400);
  });

  it('recoverStamina 类型物品成功恢复体力', async () => {
    mockGetItemById.mockReturnValue({ id: 'stamina_pill', name: '体力丹', useEffect: { type: 'recoverStamina', value: 20 } });
    const c = makeCultivator({ stamina: 30, inventory: JSON.stringify([{ itemId: 'stamina_pill', quantity: 2, equipped: false }]) });
    mockRequireCultivator.mockResolvedValueOnce({ cultivator: c });
    const updated = { ...c, stamina: 50, inventory: JSON.stringify([{ itemId: 'stamina_pill', quantity: 1, equipped: false }]) };
    mockPrisma.cultivator.update.mockResolvedValue(updated);

    const res = await POST(makeRequest({ itemId: 'stamina_pill' }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.cultivator.stamina).toBe(50);
  });

  it('addExp 类型物品增加修炼值', async () => {
    mockGetItemById.mockReturnValue({ id: 'exp_pill', name: '修炼丹', useEffect: { type: 'addExp', value: 50 } });
    const c = makeCultivator({ cultivationExp: 100, totalExp: 200, inventory: JSON.stringify([{ itemId: 'exp_pill', quantity: 1, equipped: false }]) });
    mockRequireCultivator.mockResolvedValueOnce({ cultivator: c });
    mockPrisma.cultivator.update.mockResolvedValue({ ...c, cultivationExp: 150, totalExp: 250 });

    const res = await POST(makeRequest({ itemId: 'exp_pill' }));
    const d = await res.json();
    expect(d.success).toBe(true);
    expect(d.message).toContain('修炼值');
  });

  it('learnTechnique 类型成功学习功法', async () => {
    mockGetItemById.mockReturnValue({ id: 'ancient_tome', name: '古卷', useEffect: { type: 'learnTechnique' } });
    mockTechniques['sword_foundation'] = { name: '剑道基础' };
    mockPrisma.cultivatorTechnique.findFirst.mockResolvedValue(null);
    const c = makeCultivator({ inventory: JSON.stringify([{ itemId: 'ancient_tome', quantity: 1, equipped: false }]) });
    mockRequireCultivator.mockResolvedValueOnce({ cultivator: c });
    mockPrisma.cultivator.update.mockResolvedValue({ ...c, inventory: '[]' });

    const res = await POST(makeRequest({ itemId: 'ancient_tome' }));
    const d = await res.json();
    expect(d.success).toBe(true);
    expect(d.message).toContain('领悟');
  });

  it('learnTechnique 已掌握功法返回 400', async () => {
    mockGetItemById.mockReturnValue({ id: 'ancient_tome', name: '古卷', useEffect: { type: 'learnTechnique' } });
    mockTechniques['sword_foundation'] = { name: '剑道基础' };
    mockPrisma.cultivatorTechnique.findFirst.mockResolvedValue({ id: 't1', techniqueId: 'sword_foundation' });
    const c = makeCultivator({ inventory: JSON.stringify([{ itemId: 'ancient_tome', quantity: 1, equipped: false }]) });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: c });

    const res = await POST(makeRequest({ userId: 'u1', itemId: 'ancient_tome' }));
    expect(res.status).toBe(400);
  });

  it('未知物品效果返回 400', async () => {
    mockGetItemById.mockReturnValue({ id: 'weird', name: '奇怪物品', useEffect: { type: 'unknown' } });
    const c = makeCultivator({ inventory: JSON.stringify([{ itemId: 'weird', quantity: 1, equipped: false }]) });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: c });

    const res = await POST(makeRequest({ userId: 'u1', itemId: 'weird' }));
    expect(res.status).toBe(400);
  });
});