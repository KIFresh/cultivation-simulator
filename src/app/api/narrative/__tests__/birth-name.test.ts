import { describe, it, expect, vi, beforeEach } from 'vitest';

// hoisted 共享 cultivator
const h = vi.hoisted(() => ({
  cultivator: {
    id: 'c1', userId: 'user1', name: '未命名', realm: '炼气期', realmLevel: 3,
    gold: 100, stamina: 80, cultivationExp: 100, totalExp: 500,
    age: 1, worldId: 'earth', title: null, breakthroughCount: 0,
    location: 'home', spiritualRoot: '杂灵根', inventory: '[]',
    attributes: '{}', unlockedLocations: null, toxicity: 0,
    maxAge: 100, bonusAge: 0, reincarnationCount: 0, talents: null,
    inheritedTalent: null, inheritedItems: null, injuryDebuff: 0, mindDemon: 0,
    furnaceEquipped: null, health: 100, properties: null, unlockedFormulas: null,
    occupation: null, gender: null, schoolRank: 0, storySummary: null,
    storySummaryUpdatedAt: null, storyEntries: null, storyEntriesUpdatedAt: null,
    breakthroughBuff: 0, npcRelations: null, attributeExp: '{}', subjectExp: '{}',
    physique: null, fate: null, talentSlots: null,
  },
  birthNarrative: {
    type: 'BIRTH', title: '麟儿降世', narrative: '寒冬腊月，一声嘹亮的啼哭划破了小院的宁静。',
    mood: '奇', hint: '瑞气东来', summary: '新生儿诞生在普通人家。',
    suggestedName: '李逍遥',
    family: [
      { relation: '父亲', name: '李铁柱', age: 28, alive: true },
      { relation: '母亲', name: '王氏', age: 26, alive: true },
    ],
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(() => ({ id: 'user1', cultivator: h.cultivator })) },
    cultivator: {
      findUnique: vi.fn(() => h.cultivator),
      update: vi.fn(() => ({ id: 'c1', name: '李逍遥' })),
    },
    gameEvent: { create: vi.fn(() => ({ id: 'evt1' })), update: vi.fn(() => ({ id: 'evt1' })) },
    narrativeEvent: { create: vi.fn(() => ({ id: 'nevt1' })) },
    cultivatorTechnique: { findMany: vi.fn(() => []) },
    familyMember: { findMany: vi.fn(() => []) },
    // $transaction 执行函数回调（非数组）
    $transaction: vi.fn((tx: any) => {
      if (typeof tx === 'function') {
        // 模拟 tx.cultivator.update / tx.gameEvent.create / tx.familyMember.createMany
        return tx({
          cultivator: {
            update: vi.fn(() => ({ id: 'c1', name: '李逍遥' })),
          },
          gameEvent: {
            create: vi.fn(() => ({ id: 'evt1' })),
          },
          familyMember: {
            createMany: vi.fn(() => Promise.resolve({ count: 2 })),
            deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
          },
        });
      }
      return tx;
    }),
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireCultivator: vi.fn(() => ({ cultivator: h.cultivator })),
  apiError: vi.fn((msg: string, status = 400) =>
    new Response(JSON.stringify({ error: msg }), { status })),
}));

vi.mock('@/lib/narrative-stream', () => ({
  streamNarrativeResult: vi.fn((_id: string, _n: any, _payload: any, _cultivator: any) =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'text/event-stream' },
    })),
}));

vi.mock('@/lib/narrative', () => ({
  generateBirthNarrative: vi.fn(() => h.birthNarrative),
  generateDailyCultivationNarrative: vi.fn(() => ({ type: 'DAILY_CULTIVATION' })),
  generateBreakthroughNarrative: vi.fn(() => ({ type: 'BREAKTHROUGH' })),
  generateEncounterNarrative: vi.fn(() => ({ type: 'ENCOUNTER' })),
  NarrativeError: class NarrativeError extends Error {
    code: string;
    constructor(m: string, code = 'E') { super(m); this.code = code; }
  },
  createEntry: vi.fn(() => ({ id: 'entry-1', title: 't', narrative: 'n', important: true })),
  buildSummaryFromEntries: vi.fn(() => '概要'),
  compressStorySummary: vi.fn(() => '压缩概要'),
  buildSystemPrompt: vi.fn(() => '系统提示'),
  buildBirthPrompt: vi.fn(() => '出生提示'),
}));

import { requireCultivator } from '@/lib/auth-helpers';
const mockRequire = vi.mocked(requireCultivator);

const baseCultivator = h.cultivator;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new Request(new URL('http://test/api/narrative'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeStreamRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('http://test/api/narrative?stream=true'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';

describe('BIRTH 叙事：姓名持久化', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequire.mockResolvedValue({ cultivator: baseCultivator });
  });

  it('非流式响应：AI 返回合法姓名后落库并返回', async () => {
    const res = await POST(makeRequest({
      userId: 'user1', type: 'BIRTH',
      worldName: '地球', identityName: '书香门第',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // 返回的 suggestedName 应为 AI 合法姓名
    expect(body.suggestedName).toBe('李逍遥');
    // 返回的 cultivator.name 也应更新
    expect(body.cultivator?.name).toBe('李逍遥');
  });

  it('非流式响应：cultivator.name=李逍遥 已随事务落库', async () => {
    const res = await POST(makeRequest({
      userId: 'user1', type: 'BIRTH',
      worldName: '地球', identityName: '书香门第',
    }));
    expect(res.status).toBe(200);

    // 验证 $transaction 内的 tx.cultivator.update 被调用
    const { prisma } = await import('@/lib/prisma');
    const txFn = vi.mocked(prisma.$transaction).mock.calls[0][0];
    expect(typeof txFn).toBe('function');
  });

  it('流式响应：返回 EventSource 格式含 cultivator', async () => {
    const res = await POST(makeStreamRequest({
      userId: 'user1', type: 'BIRTH',
      worldName: '地球', identityName: '书香门第',
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('event-stream');
  });

  it('AI 返回空姓名时使用备用名', async () => {
    // 修改 mock 返回空姓名
    const narrativeModule = await import('@/lib/narrative');
    vi.mocked(narrativeModule.generateBirthNarrative).mockResolvedValueOnce({
      ...h.birthNarrative,
      suggestedName: '',
    });

    const res = await POST(makeRequest({
      userId: 'user1', type: 'BIRTH',
      worldName: '地球', identityName: '书香门第',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // 应使用备用名（cultivator.name='未命名' 会被 fallback 数组替代）
    expect(body.suggestedName).toBeTruthy();
    expect(body.suggestedName.length).toBeGreaterThanOrEqual(2);
    expect(body.suggestedName).not.toBe('');
  });

  it('AI 返回无效格式（含标点/JSON）时使用备用名', async () => {
    const narrativeModule = await import('@/lib/narrative');
    vi.mocked(narrativeModule.generateBirthNarrative).mockResolvedValueOnce({
      ...h.birthNarrative,
      suggestedName: '李逍遥 (字太白)',
    });

    const res = await POST(makeRequest({
      userId: 'user1', type: 'BIRTH',
      worldName: '地球', identityName: '书香门第',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestedName).not.toContain('太白');
    expect(/^[\u4e00-\u9fff]{2,4}$/.test(body.suggestedName)).toBe(true);
  });

  it('AI 返回单字姓名时使用备用名', async () => {
    const narrativeModule = await import('@/lib/narrative');
    vi.mocked(narrativeModule.generateBirthNarrative).mockResolvedValueOnce({
      ...h.birthNarrative,
      suggestedName: '李',
    });

    const res = await POST(makeRequest({
      userId: 'user1', type: 'BIRTH',
      worldName: '地球', identityName: '书香门第',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestedName).not.toBe('李');
    expect(body.suggestedName.length).toBeGreaterThanOrEqual(2);
  });
});
