import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '../route';

const mockPrisma = vi.hoisted(() => ({
  cultivator: { findUnique: vi.fn() },
  cultivatorTechnique: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

const mockRequireCultivator = vi.hoisted(() => vi.fn());
const mockTECHNIQUES = vi.hoisted(() => ({ basic_breathing: { name: '吐纳术' } }));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth-helpers', () => ({ requireCultivator: mockRequireCultivator }));
vi.mock('@/lib/technique-data', () => ({ TECHNIQUES: mockTECHNIQUES }));

const makeCultivator = (overrides: any = {}) => ({
  id: 'c1', userId: 'u1', name: '测试', ...overrides,
});

const makeRequest = (body: any): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

describe('Techniques API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
    mockPrisma.cultivatorTechnique.findMany.mockResolvedValue([{ techniqueId: 'basic_breathing', level: 1 }]);
  });

  it('返回功法列表', async () => {
    const req = { url: 'http://localhost/api/cultivator/techniques', nextUrl: { searchParams: new URL('http://localhost/api/cultivator/techniques').searchParams } } as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.techniques).toHaveLength(1);
    expect(d.allTechniques).toBeDefined();
  });

  it('无认证返回 401', async () => {
    mockRequireCultivator.mockResolvedValueOnce({ error: { status: 401 } as NextResponse });
    const req = { url: 'http://localhost/api/cultivator/techniques', nextUrl: { searchParams: new URL('http://localhost/api/cultivator/techniques').searchParams } } as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe('Techniques API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
  });

  it('无认证返回 401', async () => {
    mockRequireCultivator.mockResolvedValueOnce({ error: { status: 401 } as NextResponse });
    const res = await POST(makeRequest({ action: 'equip', techniqueId: 't1', slot: 1 }));
    expect(res.status).toBe(401);
  });
});