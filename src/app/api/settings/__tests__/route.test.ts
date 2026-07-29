import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
  appSetting: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const mockNarrative = vi.hoisted(() => ({ syncProviderConfig: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/narrative", () => mockNarrative);

import { GET, POST } from "../route";

const ADMIN_KEY = "admin-test-key";
function request(method = "GET", body?: unknown, adminKey?: string) {
  return new NextRequest("http://localhost/api/settings", {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(adminKey ? { "x-admin-key": adminKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("settings route", () => {
  beforeEach(() => {
    process.env.ADMIN_KEY = ADMIN_KEY;
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  });

  it("拒绝没有管理员密钥的读取", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "ADMIN_REQUIRED" });
  });

  it("读取配置时不返回明文 API Key", async () => {
    mockPrisma.appSetting.findMany.mockResolvedValue([
      { key: "AI_PROVIDER_1", value: "openai" },
      { key: "AI_PROVIDER_1_KEY", value: "sk-secret" },
      { key: "AI_PROVIDER_1_MODEL", value: "gpt-test" },
    ]);
    const response = await GET(request("GET", undefined, ADMIN_KEY));
    const data = await response.json();
    expect(data.settings).toMatchObject({
      AI_PROVIDER_1: "openai",
      AI_PROVIDER_1_MODEL: "gpt-test",
      AI_PROVIDER_1_KEY_CONFIGURED: true,
    });
    expect(data.settings.AI_PROVIDER_1_KEY).toBeUndefined();
  });

  it("保存空 Key 时保持原密钥，明确 clear 才删除", async () => {
    mockPrisma.appSetting.upsert.mockResolvedValue({});
    mockPrisma.appSetting.deleteMany.mockResolvedValue({ count: 1 });
    const response = await POST(request("POST", {
      settings: {
        AI_PROVIDER_1: "openai",
        AI_PROVIDER_1_MODEL: "gpt-test",
        AI_PROVIDER_1_KEY_ACTION: "clear",
      },
    }, ADMIN_KEY));
    expect(response.status).toBe(200);
    expect(mockPrisma.appSetting.deleteMany).toHaveBeenCalledWith({ where: { key: "AI_PROVIDER_1_KEY" } });
    expect(mockNarrative.syncProviderConfig).toHaveBeenCalledOnce();
  });
});
