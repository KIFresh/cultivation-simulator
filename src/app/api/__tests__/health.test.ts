import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../api/health/route";

// Mock auth-helpers to bypass requireCultivator in health check tests
const mockRequireCultivator = vi.fn().mockResolvedValue({ cultivator: {} as any });
vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: (...args: any[]) => mockRequireCultivator(...args),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/health", {
    headers: { "x-user-id": "user-1" },
  });
}

describe("Health API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("数据库正常时返回ok", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.$queryRaw as any).mockResolvedValueOnce([{ 1: 1 }]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.status).toBe("ok");
    expect(data.db).toBe("up");
    expect(data.latencyMs).toBeGreaterThanOrEqual(0);
    expect(data.time).toBeTruthy();
  });

  it("数据库异常时返回503", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.$queryRaw as any).mockRejectedValueOnce(new Error("Connection failed"));

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.db).toBe("down");
    expect(data.message).toBe("数据库连接异常");
  });
});
