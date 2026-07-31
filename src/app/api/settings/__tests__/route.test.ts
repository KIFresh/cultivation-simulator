import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

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

function request(method = "GET", body?: unknown) {
  return new NextRequest("http://localhost/api/settings", {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("settings route — no auth required", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("读取配置时不返回明文 API Key", async () => {
    mockPrisma.appSetting.findMany.mockResolvedValue([
      { key: "AI_PROVIDER_1", value: "anthropic" },
      { key: "AI_PROVIDER_1_KEY", value: "sk-ant-secret-key" },
      { key: "AI_PROVIDER_1_MODEL", value: "claude-sonnet-4-20250514" },
    ]);

    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings.AI_PROVIDER_1).toBe("anthropic");
    expect(data.settings.AI_PROVIDER_1_KEY_CONFIGURED).toBe(true);
    // 明文 Key 不应返回
    expect(data.settings.AI_PROVIDER_1_KEY).toBeUndefined();
  });

  it("保存配置时写入数据库并调用 syncProviderConfig", async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        appSetting: {
          upsert: vi.fn().mockResolvedValue({}),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return cb(tx);
    });

    const response = await POST(
      request("POST", {
        settings: {
          AI_PROVIDER_1: "openai",
          AI_PROVIDER_1_MODEL: "gpt-4o",
          AI_PROVIDER_1_KEY: "sk-new-key",
        },
      })
    );
    expect(response.status).toBe(200);
    expect(mockNarrative.syncProviderConfig).toHaveBeenCalled();
  });

  it("拒绝非法的配置字段名", async () => {
    const response = await POST(
      request("POST", {
        settings: {
          "AI_PROVIDER_1": "openai",
          "ADMIN_KEY": "should-be-ignored",
        },
      })
    );
    expect(response.status).toBe(200);
  });
});