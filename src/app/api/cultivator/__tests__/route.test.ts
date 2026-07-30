import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST, PATCH } from "../route";
import { requireCultivator } from "@/lib/auth-helpers";

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  cultivator: { findUnique: vi.fn(), update: vi.fn() },
  cultivatorTechnique: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  familyMember: { deleteMany: vi.fn(), createMany: vi.fn() },
  gameEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const mockHashPassword = vi.hoisted(() => vi.fn(() => ({ salt: "abc", hash: "xyz" })));
const mockSignSession = vi.hoisted(() => vi.fn(() => "signed_token"));
const mockCompressStorySummary = vi.hoisted(() => vi.fn(() => "压缩后的摘要"));
const mockCreateEntry = vi.hoisted(() =>
  vi.fn((title: string, text: string, _important: boolean) => ({
    title,
    text,
    important: true,
    createdAt: new Date(),
  }))
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ hashPassword: mockHashPassword }));
vi.mock("@/lib/session", () => ({
  signSession: mockSignSession,
  SESSION_COOKIE_NAME: "session",
}));
vi.mock("@/lib", () => ({
  SPIRITUAL_ROOTS: { 火灵根: { name: "火灵根" }, 水灵根: { name: "水灵根" } },
  SpiritualRoot: {} as any,
}));
vi.mock("@/lib/narrative", () => ({
  compressStorySummary: mockCompressStorySummary,
  createEntry: mockCreateEntry,
  buildSummaryFromEntries: vi.fn(() => "摘要"),
}));

vi.mock("@/lib/auth-helpers", () => ({ requireCultivator: vi.fn() }));

const makeCultivator = (overrides: any = {}) => ({
  id: "c1",
  userId: "u1",
  name: "测试",
  realm: "凡人",
  realmLevel: 0,
  spiritualRoot: "火灵根",
  stamina: 50,
  gold: 100,
  inventory: "[]",
  cultivationExp: 0,
  totalExp: 0,
  age: 18,
  location: "home",
  storyEntries: "[]",
  storyEntriesUpdatedAt: null,
  breakthroughCount: 0,
  breakthroughBuff: 0,
  reincarnationCount: 0,
  injuryDebuff: 0,
  mindDemon: 0,
  maxAge: null,
  bonusAge: 0,
  talents: null,
  inheritedTalent: null,
  inheritedItems: null,
  attributes: null,
  ...overrides,
});

const makeRequest = (body: any): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

describe("Cultivator API - POST 创建修炼者", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("缺少 cultivatorName 和 spiritualRoot 返回 400", async () => {
    const res = await POST(makeRequest({ action: "create" }));
    expect(res.status).toBe(400);
  });

  it("无效灵根返回 400", async () => {
    const res = await POST(makeRequest({ cultivatorName: "小明", spiritualRoot: "雷灵根" }));
    expect(res.status).toBe(400);
  });

  it("已有 userId 时创建修炼者成功（原子性 + attributes + gender）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", cultivator: null });
    const mockUser = {
      id: "u1",
      name: "user1",
      cultivator: makeCultivator({
        id: "c1",
        name: "小明",
        attributes: '{"root":3,"spirit":4}',
        gender: "女",
      }),
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        user: { update: vi.fn().mockResolvedValue(mockUser) },
        cultivatorTechnique: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const res = await POST(
      makeRequest({
        userId: "u1",
        cultivatorName: "小明",
        spiritualRoot: "火灵根",
        attributes: { root: 3, spirit: 4 },
        gender: "女",
      })
    );
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.user.cultivator.name).toBe("小明");
    expect(d.user.cultivator.attributes).toBe('{"root":3,"spirit":4}');
    expect(d.user.cultivator.gender).toBe("女");
  });

  it("已有修炼者时返回 409", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", cultivator: makeCultivator() });
    const res = await POST(
      makeRequest({ userId: "u1", cultivatorName: "小明", spiritualRoot: "火灵根" })
    );
    expect(res.status).toBe(409);
  });

  it("新建用户路径创建修炼者成功（原子性 + attributes + gender）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const mockUser = {
      id: "u2",
      name: "newUser",
      cultivator: makeCultivator({
        id: "c2",
        name: "小刚",
        attributes: '{"root":5,"spirit":5}',
        gender: "男",
      }),
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue(mockUser) },
        cultivatorTechnique: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
    const res = await POST(
      makeRequest({
        userName: "newUser",
        cultivatorName: "小刚",
        spiritualRoot: "水灵根",
        attributes: { root: 5, spirit: 5 },
        gender: "男",
      })
    );
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.user.cultivator.name).toBe("小刚");
    expect(d.user.cultivator.attributes).toBe('{"root":5,"spirit":5}');
    expect(d.user.cultivator.gender).toBe("男");
  });

  it("交易失败时回滚数据库（atomic 失败）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockRejectedValue(new Error("DB error"));
    const res = await POST(
      makeRequest({
        userName: "failUser",
        cultivatorName: "失败",
        spiritualRoot: "火灵根",
      })
    );
    expect(res.status).toBe(500);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("用户名已存在返回 409", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "existing" });
    const res = await POST(
      makeRequest({
        userName: "existing",
        cultivatorName: "小刚",
        spiritualRoot: "火灵根",
      })
    );
    expect(res.status).toBe(409);
  });

  it("action=updateMemory 更新记忆", async () => {
    vi.mocked(requireCultivator).mockResolvedValue({ cultivator: makeCultivator() });
    mockPrisma.cultivator.update.mockResolvedValue(
      makeCultivator({ storyEntries: JSON.stringify([{ text: "test" }]) })
    );
    const res = await POST(
      makeRequest({ action: "updateMemory", userId: "u1", storyEntries: [{ text: "test" }] })
    );
    const d = await res.json();
    expect(d.success).toBe(true);
    expect(d.entries).toBeDefined();
  });

  it("updateMemory 无认证返回 401", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({
      error: new NextResponse(null, { status: 401 }),
    });
    const res = await POST(
      makeRequest({ action: "updateMemory", userId: "u1", storyEntries: [{ text: "test" }] })
    );
    expect(res.status).toBe(401);
  });

  it("compressMemory 无认证返回 401", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({
      error: new NextResponse(null, { status: 401 }),
    });
    const res = await POST(makeRequest({ action: "compressMemory", userId: "u1" }));
    expect(res.status).toBe(401);
  });
});

describe("Cultivator API - PATCH 更新位置", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireCultivator).mockResolvedValue({ cultivator: makeCultivator() });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", cultivator: makeCultivator() });
    mockPrisma.cultivator.update.mockResolvedValue(
      makeCultivator({ location: "school", stamina: 40 })
    );
  });

  it("缺少 userId 返回 400", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({ error: { status: 400 } as NextResponse });
    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("更新位置和体力", async () => {
    const res = await PATCH(makeRequest({ userId: "u1", location: "school", stamina: 40 }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.cultivator).toBeDefined();
  });

  it("PATCH 无认证返回 401", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({
      error: new NextResponse(null, { status: 401 }),
    });
    const req = { json: async () => ({ userId: "u1", location: "home" }) } as NextRequest;
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });
});

describe("Cultivator API - GET 获取修炼者信息", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireCultivator).mockResolvedValue({ cultivator: makeCultivator() });
  });

  it("缺少 userId 返回 400", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({ error: { status: 400 } as NextResponse });
    const res = await GET({
      url: "http://localhost/api/cultivator",
      nextUrl: { searchParams: new URL("http://localhost/api/cultivator").searchParams },
    } as NextRequest);
    expect(res.status).toBe(400);
  });

  it("获取修炼者信息成功", async () => {
    const c = makeCultivator({ storyEntries: JSON.stringify([{ title: "test", text: "test" }]) });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "user1",
      cultivator: { ...c, events: [] },
    });
    const req = {
      url: "http://localhost/api/cultivator?userId=u1",
      nextUrl: { searchParams: new URL("http://localhost/api/cultivator?userId=u1").searchParams },
    } as NextRequest;
    const res = await GET(req);
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.user).toBeDefined();
  });

  it("用户不存在返回 404", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const req = {
      url: "http://localhost/api/cultivator?userId=u1",
      nextUrl: { searchParams: new URL("http://localhost/api/cultivator?userId=u1").searchParams },
    } as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("GET 无认证返回 401", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({
      error: new NextResponse(null, { status: 401 }),
    });
    const req = {
      url: "http://localhost/api/cultivator?userId=u1",
      nextUrl: { searchParams: new URL("http://localhost/api/cultivator?userId=u1").searchParams },
    } as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
