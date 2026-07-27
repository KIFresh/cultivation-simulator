import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  cultivator: { findUnique: vi.fn(), update: vi.fn() },
  gameEvent: { create: vi.fn() },
  cultivatorTechnique: { findMany: vi.fn(), update: vi.fn() },
  familyMember: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));

const mockNarrative = vi.hoisted(() => ({
  generateBirthNarrative: vi.fn(),
  generateDailyCultivationNarrative: vi.fn(),
  generateBreakthroughNarrative: vi.fn(),
  generateEncounterNarrative: vi.fn(),
  createEntry: vi.fn((title: string, text: string, important: boolean, _summary?: string) => ({
    title, text, important, createdAt: new Date(),
  })),
  buildSummaryFromEntries: vi.fn(() => '摘要'),
  compressStorySummary: vi.fn(() => '压缩后的摘要'),
  stateFromCultivator: vi.fn((c: any) => ({
    name: c.name, age: c.age, realm: c.realm, realmLevel: c.realmLevel,
    gold: c.gold, stamina: c.stamina, locationId: c.location || 'home',
    attributes: c.attributes,
  })),
}));

const mockCanBreakthrough = vi.hoisted(() => vi.fn());
const mockPerformBreakthrough = vi.hoisted(() => vi.fn());
const mockTechniques = vi.hoisted(() => ({}));
const mockAddProficiency = vi.hoisted(() => vi.fn());
const mockCalculateTechniqueBonuses = vi.hoisted(() => vi.fn(() => ({})));
const mockStreamNarrativeResult = vi.hoisted(() => vi.fn());
const mockApplyEffects = vi.hoisted(() => vi.fn());
const mockClampEffectsArray = vi.hoisted(() => vi.fn((effects: any[]) => effects));
const mockSanitizeAttributes = vi.hoisted(() => vi.fn(() => null));
const mockCalculateMaxStamina = vi.hoisted(() => vi.fn(() => 100));
const mockGetGoldMaxGainByRealm = vi.hoisted(() => vi.fn(() => 100));
const mockRequireCultivator = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/narrative', () => mockNarrative);
vi.mock('@/lib/auth-helpers', () => ({
  requireCultivator: mockRequireCultivator,
}));
vi.mock('@/lib', () => ({
  canBreakthrough: mockCanBreakthrough,
  performBreakthrough: mockPerformBreakthrough,
}));
vi.mock('@/lib/technique-data', () => ({
  TECHNIQUES: mockTechniques,
  addProficiency: mockAddProficiency,
  calculateTechniqueBonuses: mockCalculateTechniqueBonuses,
}));
vi.mock('@/lib/narrative-stream', () => ({ streamNarrativeResult: mockStreamNarrativeResult }));
vi.mock('@/lib/narrative-effects', () => {
  const { z } = require('zod');
  return {
    applyEffects: mockApplyEffects,
    clampEffectsArray: mockClampEffectsArray,
    NarrativeEffectSchema: z.object({
      kind: z.string(),
      delta: z.number(),
      targetRelation: z.string().optional(),
    }),
  };
});
vi.mock('@/lib/utils', () => ({ sanitizeAttributes: mockSanitizeAttributes }));
vi.mock('@/lib/cultivation-data', () => ({ calculateMaxStamina: mockCalculateMaxStamina }));
vi.mock('@/lib/gold', () => ({ getGoldMaxGainByRealm: mockGetGoldMaxGainByRealm }));

const makeCultivator = (overrides: any = {}) => ({
  id: 'c1', userId: 'u1', name: '测试', realm: '炼气期', realmLevel: 1,
  spiritualRoot: '火灵根', stamina: 50, gold: 100, inventory: '[]',
  cultivationExp: 100, totalExp: 200, age: 18, location: 'home',
  storyEntries: '[]', storyEntriesUpdatedAt: null,
  breakthroughCount: 0, breakthroughBuff: 0, reincarnationCount: 0,
  injuryDebuff: 0, mindDemon: 0, maxAge: 80, bonusAge: 0,
  talents: null, inheritedTalent: null, inheritedItems: null,
  attributes: null, ...overrides,
});

const makeRequest = (url: string, body: any): NextRequest =>
  ({ url, nextUrl: { searchParams: new URL(url).searchParams }, json: async () => body }) as unknown as NextRequest;

describe('Narrative API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator() } as any);
    const c = makeCultivator();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', cultivator: c });
    mockPrisma.cultivator.findUnique.mockResolvedValue(c);
    mockPrisma.cultivatorTechnique.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (txn: any) => {
      if (typeof txn === 'function') {
        return txn({
          cultivator: { update: vi.fn((a: any) => ({ ...c, ...a.data })) },
          gameEvent: { create: vi.fn((a: any) => ({ id: 'evt1', ...a.data })) },
          cultivatorTechnique: { update: vi.fn() },
          familyMember: { deleteMany: vi.fn(), createMany: vi.fn() },
        });
      }
      return [{ id: 'evt1' }];
    });
    mockNarrative.generateBirthNarrative.mockResolvedValue({
      title: '出生', narrative: '你出生了', mood: '静',
      suggestedName: '小石头', family: [],
      summary: '出生故事',
    });
    mockNarrative.generateDailyCultivationNarrative.mockResolvedValue({
      title: '修行', narrative: '你修炼了一天', mood: '静',
      hint: '继续努力', goldChange: 0,
    });
    mockNarrative.generateBreakthroughNarrative.mockResolvedValue({
      title: '突破', narrative: '你突破了', mood: '燃', summary: '突破成功',
    });
    mockNarrative.generateEncounterNarrative.mockResolvedValue({
      title: '奇遇', narrative: '遇到了奇遇', mood: '奇',
      goldChange: 0, choices: [], summary: '奇遇故事',
    });
    mockPerformBreakthrough.mockReturnValue({
      newRealm: '炼气期', newLevel: 2, newExp: 50, success: true,
    });
    mockCanBreakthrough.mockReturnValue(true);
    mockAddProficiency.mockReturnValue({ newLevel: 1, newProficiency: 5, leveledUp: false });
  });

  it('缺少 type 返回 400', async () => {
    const res = await POST(makeRequest('http://localhost', { userId: 'u1' }));
    expect(res.status).toBe(400);
  });

  it('未知叙事类型返回 400', async () => {
    const res = await POST(makeRequest('http://localhost', { userId: 'u1', type: 'UNKNOWN' }));
    expect(res.status).toBe(400);
  });

  it('BIRTH 类型成功生成叙事', async () => {
    const res = await POST(makeRequest('http://localhost', {
      userId: 'u1', type: 'BIRTH', worldName: '仙侠世界',
    }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.narrative).toBeDefined();
    expect(d.event).toBeDefined();
  });

  it('DAILY_CULTIVATION 类型成功生成叙事', async () => {
    const res = await POST(makeRequest('http://localhost', {
      userId: 'u1', type: 'DAILY_CULTIVATION', taskType: 'CUSTOM', taskDescription: '打坐',
    }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.narrative.title).toBe('修行');
    expect(d.canBreakthrough).toBeDefined();
  });

  it('BREAKTHROUGH 类型成功突破', async () => {
    const res = await POST(makeRequest('http://localhost', {
      userId: 'u1', type: 'BREAKTHROUGH',
    }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.narrative.title).toBe('突破');
    expect(d.cultivator).toBeDefined();
  });

  it('BREAKTHROUGH 无法突破时返回 400', async () => {
    mockPerformBreakthrough.mockReturnValue(null);
    const res = await POST(makeRequest('http://localhost', {
      userId: 'u1', type: 'BREAKTHROUGH',
    }));
    expect(res.status).toBe(400);
  });

  it('ENCOUNTER 类型成功生成叙事', async () => {
    const res = await POST(makeRequest('http://localhost', {
      userId: 'u1', type: 'ENCOUNTER',
    }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.narrative.title).toBe('奇遇');
  });

  it('ENCOUNTER 带选择分支', async () => {
    mockNarrative.generateEncounterNarrative.mockResolvedValue({
      title: '奇遇', narrative: '遇到了奇遇', mood: '奇',
      goldChange: 10, choices: [{ text: '接受', riskLevel: 'low' }],
      summary: '奇遇故事',
    });
    const res = await POST(makeRequest('http://localhost', {
      userId: 'u1', type: 'ENCOUNTER', choiceIndex: 0,
    }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.chosenOption).toBe(0);
  });
});