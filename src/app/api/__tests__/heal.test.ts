import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "../../api/heal/route";

const fakeCultivator: any = {
  id: "c1",
  userId: "u1",
  name: "测试",
  spiritualRoot: "杂灵根",
  realm: "凡人",
  age: 8,
  health: 50,
  stamina: 10,
  gold: 50,
  properties: null,
  attributes: "{}",
};

vi.mock("@/lib/auth-helpers", () => ({
  requireCultivator: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { cultivator: { update: vi.fn() } },
}));
vi.mock("@/lib/json-helper", () => ({
  json: { properties: vi.fn() },
}));

import { requireCultivator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { json } from "@/lib/json-helper";

// 把 update 的 data 合并回 fakeCultivator（解析 decrement/increment）
function mockUpdate() {
  vi.mocked(prisma.cultivator.update).mockImplementation((async (args: any) => {
    const data = args.data;
    const merged: any = { ...fakeCultivator };
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (v && typeof v === "object" && "decrement" in v)
        merged[k] = (fakeCultivator as any)[k] - v.decrement;
      else if (v && typeof v === "object" && "increment" in v)
        merged[k] = (fakeCultivator as any)[k] + v.increment;
      else merged[k] = v;
    }
    return merged;
  }) as any);
}

function req(body: any): any {
  return { json: async () => body };
}

describe("Heal API (P1#5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeCultivator.health = 50;
    fakeCultivator.stamina = 10;
    fakeCultivator.gold = 50;
    fakeCultivator.properties = null;
    vi.mocked(requireCultivator).mockResolvedValue({ cultivator: fakeCultivator });
    mockUpdate();
  });

  it("rest 无床回血 +20 并扣 1 行动力", async () => {
    vi.mocked(json.properties).mockReturnValue([]);
    const res = await POST(req({ userId: "u1", mode: "rest" }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.healthDelta).toBe(20);
    expect(d.cultivator.health).toBe(70);
    expect(d.cultivator.stamina).toBe(9);
  });

  it("rest 有床家具再 +10（共 +30）", async () => {
    vi.mocked(json.properties).mockReturnValue([{ selfLiving: true, furniture: ["bed"] }]);
    const res = await POST(req({ userId: "u1", mode: "rest" }));
    const d = await res.json();
    expect(d.healthDelta).toBe(30);
    expect(d.cultivator.health).toBe(80);
  });

  it("rest 行动力不足返回 400", async () => {
    fakeCultivator.stamina = 0;
    const res = await POST(req({ userId: "u1", mode: "rest" }));
    const d = await res.json();
    expect(res.status).toBe(400);
    expect(d.error).toBe("行动力不足");
  });

  it("clinic 花 15 金回血 +50（clamp 100）", async () => {
    fakeCultivator.health = 60;
    const res = await POST(req({ userId: "u1", mode: "clinic" }));
    const d = await res.json();
    expect(res.status).toBe(200);
    expect(d.healthDelta).toBe(40); // 60 + 50 -> 100，delta 40
    expect(d.cultivator.health).toBe(100);
    expect(d.cultivator.gold).toBe(35);
    expect(d.goldChanged).toBe(-15);
  });

  it("clinic 金币不足返回 400", async () => {
    fakeCultivator.gold = 10;
    const res = await POST(req({ userId: "u1", mode: "clinic" }));
    const d = await res.json();
    expect(res.status).toBe(400);
    expect(d.error).toBe("金币不足");
  });

  it("未鉴权返回 401", async () => {
    vi.mocked(requireCultivator).mockResolvedValueOnce({
      error: NextResponse.json({ error: "AUTH" }, { status: 401 }),
    });
    const res = await POST(req({ userId: "u1", mode: "rest" }));
    expect(res.status).toBe(401);
  });

  it("非法 mode 返回 400", async () => {
    const res = await POST(req({ userId: "u1", mode: "fly" }));
    expect(res.status).toBe(400);
  });
});
