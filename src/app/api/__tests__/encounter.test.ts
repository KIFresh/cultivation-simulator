import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../encounter/route';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  gameEvent: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  cultivator: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

const mockEncounterData = vi.hoisted(() => ({
  shouldTriggerEncounter: vi.fn(() => true),
  pickRandomEncounter: vi.fn(),
  serializeEncounter: vi.fn((e: any) => ({ id: e.id, title: e.title })),
  resolveHighRiskOutcome: vi.fn(() => true),
  applyRewardEffects: vi.fn((_rewards: any, stats: any) => ({
    cultivationExp: stats.cultivationExp + 10,
    totalExp: stats.totalExp + 10,
    stamina: stats.stamina,
    message: '奖励已发放',
    specialItems: [],
  })),
  ENCOUNTER_POOL: [
    { id: 'e1', title: '悬崖遇仙', narrative: '…', choices: [
      { riskLevel: 'low', text: '谨慎', hint: '安全', rewards: [{ type: 'cultivationExp', value: 10, label: '+10修炼值' }], successNarrative: '…' },
      { riskLevel: 'high', text: '冒险', hint: '高回报', rewards: [{ type: 'cultivationExp', value: 50, label: '+50修炼值' }], successNarrative: '…' },
    ] },
  ],
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/encounter-data', () => mockEncounterData);
vi.mock('@/lib/cultivation-data', () => ({
  REALMS: [{ name: '凡人' }, { name: '炼气期' }],
  getItemById: vi.fn(() => null),
}));

const makeCultivator = (overrides: any = {}) => ({
  id: 'c1', userId: 'u1', name: '测试', spiritualRoot: '火灵根',
  realm: '炼气期', realmLevel: 1, cultivationExp: 100, totalExp: 200,
  stamina: 50, gold: 100, inventory: '[]', age: 18, location: 'home',
  storyEntries: '[]', breakthroughBuff: 0, maxAge: null, bonusAge: 0,
  breakthroughCount: 0, reincarnationCount: 0, injuryDebuff: 0,
  mindDemon: 0, talents: null, inheritedTalent: null, inheritedItems: null,
  attributes: null, ...overrides,
});

const makeRequest = (url: string, body?: any): NextRequest => ({
  url,
  nextUrl: { searchParams: new URL(url).searchParams },
  json: async () => body,
}) as unknown as NextRequest;

describe('Encounter API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: makeCultivator() });
    mockPrisma.gameEvent.count.mockResolvedValue(0);
    mockPrisma.gameEvent.create.mockResolvedValue({ id: 'evt1' });
    mockEncounterData.pickRandomEncounter.mockReturnValue({
      id: 'e1', title: '悬崖遇仙', narrative: '…',
      choices: [{ riskLevel: 'low', text: '谨慎', hint: '安全', rewards: [] }],
    });
  });

  it('缺少 userId 返回 400', async () => {
    const res = await GET(makeRequest('http://localhost/api/encounter'));
    const d = await res.json();
    expect(res.status).toBe(400);
    expect(d.error).toBe('缺少 userId');
  });

  it('无 cultivator 返回 400', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: null });
    const res = await GET(makeRequest('http://localhost/api/encounter?userId=u1'));
    expect(res.status).toBe(400);
  });

  it('手动探索超过 3 次返回未触发', async () => {
    mockPrisma.gameEvent.count.mockResolvedValue(3);
    const res = await GET(makeRequest('http://localhost/api/encounter?userId=u1&source=manual'));
    const d = await res.json();
    expect(d.triggered).toBe(false);
    expect(d.reason).toContain('机缘已尽');
  });

  it('shouldTriggerEncounter 返回 false 时未触发', async () => {
    mockEncounterData.shouldTriggerEncounter.mockReturnValue(false);
    const res = await GET(makeRequest('http://localhost/api/encounter?userId=u1'));
    const d = await res.json();
    expect(d.triggered).toBe(false);
    // 恢复默认实现
    mockEncounterData.shouldTriggerEncounter.mockReset();
    mockEncounterData.shouldTriggerEncounter.mockImplementation(() => true);
  });

  it('成功触发奇遇返回 eventId', async () => {
    const res = await GET(makeRequest('http://localhost/api/encounter?userId=u1'));
    const d = await res.json();
    expect(d.triggered).toBe(true);
    expect(d.eventId).toBe('evt1');
    expect(d.encounter).toBeDefined();
  });
});

describe('Encounter API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const c = makeCultivator();
    mockPrisma.gameEvent.findUnique.mockResolvedValue({
      id: 'evt1', cultivatorId: 'c1', type: 'ENCOUNTER',
      title: '悬崖遇仙', chosenOption: null,
      reward: JSON.stringify({ encounterId: 'e1' }),
    });
    mockPrisma.cultivator.findUnique.mockResolvedValue(c);
    mockPrisma.$transaction.mockImplementation(async (txn: any) => {
      if (typeof txn === 'function') {
        return txn({
          cultivator: { update: vi.fn((a: any) => ({ ...c, ...a.data })) },
          gameEvent: { update: vi.fn((a: any) => ({ id: 'evt1', ...a.data })) },
        });
      }
      return [c, { id: 'evt1' }];
    });
  });

  it('缺少必填参数返回 400', async () => {
    const res = await POST(makeRequest('http://localhost', { userId: 'u1' }));
    expect(res.status).toBe(400);
  });

  it('无效选项索引返回 400', async () => {
    const res = await POST(makeRequest('http://localhost', { eventId: 'evt1', userId: 'u1', choiceIndex: 5 }));
    expect(res.status).toBe(400);
  });

  it('已结算奇遇返回 400', async () => {
    mockPrisma.gameEvent.findUnique.mockResolvedValue({
      id: 'evt1', cultivatorId: 'c1', type: 'ENCOUNTER', chosenOption: 0,
    });
    const res = await POST(makeRequest('http://localhost', { eventId: 'evt1', userId: 'u1', choiceIndex: 0 }));
    expect(res.status).toBe(400);
  });

  it('成功选择低风险选项', async () => {
    const res = await POST(makeRequest('http://localhost', { eventId: 'evt1', userId: 'u1', choiceIndex: 0 }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.success).toBe(true);
    expect(d.choice.riskLevel).toBe('low');
  });
});