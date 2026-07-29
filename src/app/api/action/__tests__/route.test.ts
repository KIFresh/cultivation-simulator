import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockExecuteAction = vi.hoisted(() => vi.fn());

vi.mock('@/server/action/action-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/action/action-service')>();
  return {
    ...actual,
    executeAction: async (...args: Parameters<typeof actual.executeAction>) => {
      mockExecuteAction(...args);
      return actual.executeAction(...args);
    },
  };
});

import { POST } from '../route';

const mockRequireCultivator = vi.hoisted(() => vi.fn());

// Mock prisma - minimal surface needed for action route
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    cultivator: { findUnique: vi.fn(() => null), update: vi.fn() },
    cultivatorTechnique: { findMany: vi.fn(() => []), update: vi.fn(), create: vi.fn() },
    gameEvent: { create: vi.fn(() => ({ id: 'evt1' })), count: vi.fn(() => 0) },
    $transaction: vi.fn((tx: any) => (Array.isArray(tx) ? Promise.resolve(tx) : tx({}))),
  },
}));

// Mock auth
vi.mock('@/lib/auth-helpers', () => {
  const baseCultivator = {
    id: 'c1', userId: 'u1', name: '测试者', realm: '炼气期', realmLevel: 3,
    gold: 100, stamina: 80, cultivationExp: 100, totalExp: 500,
    age: 16, worldId: 'earth', title: null, breakthroughCount: 0,
    location: 'home', spiritualRoot: '杂灵根', inventory: '[]',
    attributes: '{"root":10,"spirit":8,"insight":6,"luck":5,"charm":4,"mind":7}',
    unlockedLocations: null, toxicity: 0,
    maxAge: null, bonusAge: 0, reincarnationCount: 0, talents: '["protagonist"]',
    inheritedTalent: null, inheritedItems: null,
    injuryDebuff: 0, mindDemon: 0, furnaceEquipped: null,
    storyEntries: null, storyEntriesUpdatedAt: null,
  } as any;
  return {
    requireCultivator: mockRequireCultivator,
    apiError: vi.fn((msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status })),
  };
});

// Mock narrative
vi.mock('@/lib/narrative', () => ({
  generateActionNarrative: vi.fn(() => ({
    type: 'ACTION', title: '冥想', narrative: '你静心冥想，灵力有所提升。', mood: '静',
    hint: '继续', summary: '冥想结束',
  })),
  createEntry: vi.fn(() => ({ title: '记忆', narrative: '内容', important: false })),
  buildSummaryFromEntries: vi.fn(() => '概要'),
  stateFromCultivator: vi.fn(() => ({ location: 'home', age: 16, realm: '炼气期' })),
}));

// Mock combat engine
vi.mock('@/lib/combat-engine', () => ({
  resolveCombat: vi.fn(),
}));

// Mock enemy data
vi.mock('@/lib/enemy-data', () => ({
  getEnemiesForLocation: vi.fn(),
}));

// Mock mind demon
vi.mock('@/lib/mind-demon', () => ({
  checkMindDemon: vi.fn(() => null),
  calcCombatMindDemon: vi.fn(),
  MIND_DEMON_EFFECTS: { staminaCost: 5, expCost: 10 },
}));

// Mock technique data
vi.mock('@/lib/technique-data', () => ({
  TECHNIQUES: {},
  calculateTechniqueBonuses: vi.fn(() => ({})),
  addProficiency: vi.fn(),
  triggerStudyEvent: vi.fn(),
  calcTechniqueProficiency: vi.fn(),
}));

// Mock effects
vi.mock('@/lib/narrative-effects', () => {
  const z = require('zod');
  return {
    applyEffects: vi.fn(() => ({})),
    clampEffectsArray: vi.fn((e: any[]) => e),
    NarrativeEffectSchema: z.object({
      kind: z.string(),
      delta: z.number().optional(),
      targetRelation: z.string().optional(),
    }),
  };
});

// Mock gold
vi.mock('@/lib/gold', () => ({
  getGoldMaxGainByRealm: vi.fn(() => 50),
}));

import { prisma } from '@/lib/prisma';

const mockFindUnique = vi.mocked(prisma.user.findUnique) as any;
const mockCultivatorUpdate = vi.mocked(prisma.cultivator.update) as any;
const mockTechniqueFindMany = vi.mocked(prisma.cultivatorTechnique.findMany) as any;

const baseCultivator = {
  id: 'c1', userId: 'user1', name: '测试者', realm: '炼气期', realmLevel: 3,
  gold: 100, stamina: 80, cultivationExp: 100, totalExp: 500,
  age: 16, worldId: 'earth', title: null, breakthroughCount: 0,
  location: 'home', spiritualRoot: '杂灵根', inventory: '[]',
  attributes: '{"root":10,"spirit":8,"insight":6,"luck":5,"charm":4,"mind":7}',
  unlockedLocations: null, toxicity: 0,
  maxAge: null, bonusAge: 0, reincarnationCount: 0, talents: '["protagonist"]',
  inheritedTalent: null, inheritedItems: null,
  injuryDebuff: 0, mindDemon: 0, furnaceEquipped: null,
  storyEntries: null, storyEntriesUpdatedAt: null,
} as any;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://test/api/action'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'u1' },
    body: JSON.stringify(body),
  });
}

describe('Action API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCultivator.mockResolvedValue({ cultivator: baseCultivator } as any);
    (prisma.$transaction as any).mockImplementation((tx: any) => {
      if (typeof tx === 'function') {
        return tx({
          cultivator: { update: vi.fn().mockResolvedValue(baseCultivator) },
          gameEvent: { create: vi.fn().mockResolvedValue({ id: 'evt1' }) },
          cultivatorTechnique: { update: vi.fn().mockResolvedValue({}) },
        });
      }
      return Promise.resolve(tx);
    });
  });

  describe('POST /api/action', () => {
    it('缺少 actionId 返回 400', async () => {
      const req = new NextRequest('http://test/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'u1' },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('无效 actionId 返回 400', async () => {
      const req = new NextRequest('http://test/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'u1' },
        body: JSON.stringify({ actionId: 'INVALID_ACTION' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('成功执行冥想行动', async () => {
      const req = new NextRequest('http://test/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'u1' },
        body: JSON.stringify({ actionId: 'MEDITATE' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.narrative).toBeDefined();
      expect(data.cultivator).toBeDefined();
    });

    it('将 NPC 选择转发给行动服务', async () => {
      const req = makeRequest({
        actionId: 'MEDITATE',
        freeInput: '递上一杯热茶',
        npcIds: ['赵母', '', 7],
        npcNames: ['赵母', '  ', null],
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockExecuteAction).toHaveBeenCalledWith(
        expect.objectContaining({
          freeInput: '递上一杯热茶',
          npcIds: ['赵母'],
          npcNames: ['赵母'],
        }),
        baseCultivator
      );
    });

    it('体力不足时返回 400', async () => {
      const lowStaminaCultivator = { ...baseCultivator, stamina: 3 };
      mockRequireCultivator.mockResolvedValueOnce({ cultivator: lowStaminaCultivator } as any);
      const req = makeRequest({ actionId: 'MEDITATE' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('行动力不足');
    });
  });
});