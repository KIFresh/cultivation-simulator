import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  familyMember: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

const mockAuth = vi.hoisted(() => ({
  requireCultivator: vi.fn(),
  apiError: vi.fn((msg: string, status = 400) =>
    new Response(JSON.stringify({ error: msg }), { status }),
  ),
}));

vi.mock('@/lib/auth-helpers', () => mockAuth);

// ── Helpers ──────────────────────────────────────────────────

function makeGetRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

function makePostRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

const makeCultivator = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  userId: 'u1',
  name: '测试',
  stamina: 20,
  realm: '炼气期',
  realmLevel: 1,
  gold: 50,
  worldId: 'earth',
  age: 18,
  location: 'home',
  attributes: null,
  inventory: '[]',
  npcRelations: null,
  storySummary: null,
  storySummaryUpdatedAt: null,
  storyEntries: '[]',
  storyEntriesUpdatedAt: null,
  talents: null,
  spiritualRoot: '火灵根',
  title: null,
  maxAge: null,
  bonusAge: 0,
  breakthroughCount: 0,
  breakthroughBuff: 0,
  reincarnationCount: 0,
  injuryDebuff: 0,
  mindDemon: 0,
  occupation: null,
  schoolRank: 0,
  unlockedLocations: null,
  unlockedFormulas: null,
  toxicity: 0,
  furnaceEquipped: null,
  cultivationExp: 100,
  totalExp: 200,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────

describe('GET /api/family', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.requireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
  });

  it('缺少 userId 时返回 401', async () => {
    const res = await GET(makeGetRequest('http://localhost/api/family'));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('缺少用户标识');
  });

  it('返回家庭成员列表', async () => {
    const fakeMembers = [
      { id: 'm1', cultivatorId: 'c1', relation: '父亲', name: '张三', age: 45, alive: true, intimacy: 50, dialogueHistory: '[]' },
      { id: 'm2', cultivatorId: 'c1', relation: '母亲', name: '李四', age: 42, alive: true, intimacy: 55, dialogueHistory: '[]' },
    ];
    mockPrisma.familyMember.findMany.mockResolvedValue(fakeMembers);

    const res = await GET(makeGetRequest('http://localhost/api/family?userId=u1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.members).toHaveLength(2);
    expect(data.members[0].relation).toBe('父亲');
    expect(data.members[1].relation).toBe('母亲');
  });

  it('解析 dialogueHistory JSON', async () => {
    const fakeMembers = [
      { id: 'm1', cultivatorId: 'c1', relation: '父亲', name: '张三', age: 45, alive: true, intimacy: 50, dialogueHistory: '[{"role":"player","content":"你好","timestamp":100}]' },
    ];
    mockPrisma.familyMember.findMany.mockResolvedValue(fakeMembers);

    const res = await GET(makeGetRequest('http://localhost/api/family?userId=u1'));
    const data = await res.json();
    expect(data.members[0].dialogueHistory).toEqual([{ role: 'player', content: '你好', timestamp: 100 }]);
  });

  it('cultivatorId 不匹配时返回 403', async () => {
    const res = await GET(makeGetRequest('http://localhost/api/family?userId=u1&cultivatorId=wrong-id'));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('无权访问');
  });

  it('auth 失败时返回错误', async () => {
    mockAuth.requireCultivator.mockResolvedValue({ error: mockAuth.apiError('无效的用户 ID', 400) });

    const res = await GET(makeGetRequest('http://localhost/api/family?userId=invalid'));
    expect(res.status).toBe(400);
  });

  it('按 relation 排序', async () => {
    const fakeMembers = [
      { id: 'm1', cultivatorId: 'c1', relation: '母亲', name: '李四', age: 42, alive: true, intimacy: 55, dialogueHistory: '[]' },
      { id: 'm2', cultivatorId: 'c1', relation: '父亲', name: '张三', age: 45, alive: true, intimacy: 50, dialogueHistory: '[]' },
    ];
    mockPrisma.familyMember.findMany.mockResolvedValue(fakeMembers);

    await GET(makeGetRequest('http://localhost/api/family?userId=u1'));
    expect(mockPrisma.familyMember.findMany).toHaveBeenCalledWith({
      where: { cultivatorId: 'c1' },
      orderBy: { relation: 'asc' },
    });
  });

  it('查询失败时返回 500', async () => {
    mockPrisma.familyMember.findMany.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeGetRequest('http://localhost/api/family?userId=u1'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/family', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.requireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
    mockPrisma.familyMember.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.familyMember.createMany.mockResolvedValue({ count: 2 });
  });

  it('缺少 userId 时返回 401', async () => {
    const res = await POST(makePostRequest({ members: [] }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('缺少用户标识');
  });

  it('缺少 members 时返回 400', async () => {
    const res = await POST(makePostRequest({ userId: 'u1' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('缺少家庭成员数据');
  });

  it('members 为空数组时返回 400', async () => {
    const res = await POST(makePostRequest({ userId: 'u1', members: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('缺少家庭成员数据');
  });

  it('批量创建家庭成员成功', async () => {
    const members = [
      { relation: '父亲', name: '张三', age: 45, alive: true, intimacy: 50 },
      { relation: '母亲', name: '李四', age: 42 },
    ];
    const res = await POST(makePostRequest({ userId: 'u1', members }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
  });

  it('先删除旧家庭成员再创建新成员', async () => {
    const members = [{ relation: '父亲', name: '张三', age: 45 }];
    await POST(makePostRequest({ userId: 'u1', members }));

    expect(mockPrisma.familyMember.deleteMany).toHaveBeenCalledWith({
      where: { cultivatorId: 'c1' },
    });
    expect(mockPrisma.familyMember.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          cultivatorId: 'c1',
          relation: '父亲',
          name: '张三',
          age: 45,
          alive: true,
          intimacy: 50,
        }),
      ],
    });
  });

  it('未提供 alive/intimacy 时使用默认值', async () => {
    const members = [{ relation: '弟弟', name: '张小', age: 10 }];
    await POST(makePostRequest({ userId: 'u1', members }));

    expect(mockPrisma.familyMember.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          alive: true,
          intimacy: 50,
        }),
      ],
    });
  });

  it('auth 失败时返回错误', async () => {
    mockAuth.requireCultivator.mockResolvedValue({ error: mockAuth.apiError('无效的用户 ID', 400) });

    const res = await POST(makePostRequest({
      userId: 'invalid',
      members: [{ relation: '父亲', name: '张三', age: 45 }],
    }));
    expect(res.status).toBe(400);
  });

  it('创建失败时返回 500', async () => {
    mockPrisma.familyMember.createMany.mockRejectedValue(new Error('DB error'));
    const res = await POST(makePostRequest({
      userId: 'u1',
      members: [{ relation: '父亲', name: '张三', age: 45 }],
    }));
    expect(res.status).toBe(500);
  });
});