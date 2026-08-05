import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const mockPrisma = vi.hoisted(() => ({
  cultivator: { update: vi.fn() },
}));

const mockRequireCultivator = vi.hoisted(() => vi.fn());
const mockApiError = vi.hoisted(() =>
  vi.fn((msg: string, status: number) => new Response(JSON.stringify({ error: msg }), { status }))
);
const mockGetItemById = vi.hoisted(() => vi.fn());
const mockJsonHelper = vi.hoisted(() => ({
  inventory: vi.fn((raw: string | null) => {
    try {
      return JSON.parse(raw || "[]");
    } catch {
      return [];
    }
  }),
  attributes: vi.fn((raw: string | null) => {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  }),
}));
const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: mockRequireCultivator,
  apiError: mockApiError,
}));
vi.mock("@/lib", () => ({ getItemById: mockGetItemById }));
vi.mock("@/lib/json-helper", () => ({ json: mockJsonHelper }));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

const makeCultivator = (overrides: any = {}) => ({
  id: "c1",
  userId: "u1",
  name: "测试",
  realm: "炼气期",
  realmLevel: 1,
  stamina: 50,
  gold: 100,
  inventory: "[]",
  age: 18,
  location: "home",
  cultivationExp: 100,
  totalExp: 200,
  spiritualRoot: "火灵根",
  breakthroughCount: 0,
  breakthroughBuff: 0,
  reincarnationCount: 0,
  injuryDebuff: 0,
  mindDemon: 0,
  maxAge: 80,
  bonusAge: 0,
  talents: null,
  inheritedTalent: null,
  inheritedItems: null,
  attributes: '{"root": 10}',
  ...overrides,
});

const makeRequest = (body: any): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

describe("UseItem API - POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator() });
    mockApiError.mockImplementation(
      (msg: string, status: number) => new Response(JSON.stringify({ error: msg }), { status })
    );
  });

  it("缺少 userId 或 itemId 返回 400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const res2 = await POST(makeRequest({ userId: "u1" }));
    expect(res2.status).toBe(400);
  });

  it("物品不存在返回 400", async () => {
    mockGetItemById.mockReturnValue(undefined);
    const res = await POST(makeRequest({ userId: "u1", itemId: "unknown" }));
    expect(res.status).toBe(400);
  });

  it("物品无 useEffect 返回 400", async () => {
    mockGetItemById.mockReturnValue({ id: "stone", useEffect: null });
    const res = await POST(makeRequest({ userId: "u1", itemId: "stone" }));
    expect(res.status).toBe(400);
  });

  it("背包无该物品返回 400", async () => {
    mockGetItemById.mockReturnValue({
      id: "pill",
      useEffect: { type: "recoverStamina", value: 20 },
    });
    mockRequireCultivator.mockResolvedValue({ cultivator: makeCultivator({ inventory: "[]" }) });
    const res = await POST(makeRequest({ userId: "u1", itemId: "pill" }));
    expect(res.status).toBe(400);
  });

  it("recoverStamina 恢复体力", async () => {
    mockGetItemById.mockReturnValue({
      id: "stamina_pill",
      useEffect: { type: "recoverStamina", value: 20 },
    });
    const c = makeCultivator({
      stamina: 10,
      inventory: JSON.stringify([{ itemId: "stamina_pill", quantity: 2, equipped: false }]),
    });
    mockRequireCultivator.mockResolvedValue({ cultivator: c });
    mockPrisma.cultivator.update.mockResolvedValue({
      ...c,
      stamina: 30,
      inventory: JSON.stringify([{ itemId: "stamina_pill", quantity: 1, equipped: false }]),
    });

    const res = await POST(makeRequest({ userId: "u1", itemId: "stamina_pill" }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.cultivator.stamina).toBe(30);
    expect(d.usedItem).toBe("stamina_pill");
  });

  it("boostAttr 提升属性", async () => {
    mockGetItemById.mockReturnValue({
      id: "root_pill",
      useEffect: { type: "boostAttr", value: 5, targetAttr: "root" },
    });
    const c = makeCultivator({
      attributes: '{"root": 10}',
      inventory: JSON.stringify([{ itemId: "root_pill", quantity: 1, equipped: false }]),
    });
    mockRequireCultivator.mockResolvedValue({ cultivator: c });
    mockPrisma.cultivator.update.mockResolvedValue({
      ...c,
      attributes: '{"root": 15}',
      inventory: "[]",
    });

    const res = await POST(makeRequest({ userId: "u1", itemId: "root_pill" }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.cultivator).toBeDefined();
  });

  it("addExp 增加修炼值", async () => {
    mockGetItemById.mockReturnValue({ id: "exp_pill", useEffect: { type: "addExp", value: 50 } });
    const c = makeCultivator({
      cultivationExp: 100,
      totalExp: 200,
      inventory: JSON.stringify([{ itemId: "exp_pill", quantity: 1, equipped: false }]),
    });
    mockRequireCultivator.mockResolvedValue({ cultivator: c });
    mockPrisma.cultivator.update.mockResolvedValue({ ...c, cultivationExp: 150, totalExp: 250 });

    const res = await POST(makeRequest({ userId: "u1", itemId: "exp_pill" }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.cultivator.cultivationExp).toBe(150);
  });

  it("不支持的效果类型返回 400", async () => {
    mockGetItemById.mockReturnValue({ id: "weird", useEffect: { type: "unknownEffect" } });
    const c = makeCultivator({
      inventory: JSON.stringify([{ itemId: "weird", quantity: 1, equipped: false }]),
    });
    mockRequireCultivator.mockResolvedValue({ cultivator: c });

    const res = await POST(makeRequest({ userId: "u1", itemId: "weird" }));
    expect(res.status).toBe(400);
  });

  it("未鉴权返回 401", async () => {
    mockRequireCultivator.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "AUTH" }), { status: 401 }),
    });
    const res = await POST(makeRequest({ userId: "u1", itemId: "pill" }));
    expect(res.status).toBe(401);
  });
});
