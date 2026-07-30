import { describe, it, expect, vi } from "vitest";
import {
  rollInitialLocationNpcs,
  interactLocationNpc,
  isLocationNpc,
  clampIntimacy,
  LOCATION_NPC_POOL,
  LOCATION_NPC_ACTION_DEFS,
  type LocationNpc,
} from "../location-npcs";

vi.mock("@/lib/encounter-data", () => ({
  getFateFirstMeetOffset: vi.fn(() => 0),
}));

describe("LOCATION_NPC_POOL", () => {
  it("应包含所有预期地点", () => {
    const locations = ["park", "kindergarten", "library", "clinic", "home", "school", "market"];
    for (const loc of locations) {
      expect(LOCATION_NPC_POOL[loc]).toBeDefined();
      expect(LOCATION_NPC_POOL[loc].length).toBeGreaterThan(0);
    }
  });

  it("每个 NPC 应有 name、avatar、realm", () => {
    for (const npcs of Object.values(LOCATION_NPC_POOL)) {
      for (const npc of npcs) {
        expect(typeof npc.name).toBe("string");
        expect(typeof npc.avatar).toBe("string");
        expect(typeof npc.realm).toBe("string");
      }
    }
  });
});

describe("rollInitialLocationNpcs", () => {
  it("应为同一 cultivatorId + locationId + age 返回相同结果", () => {
    const a = rollInitialLocationNpcs("c1", "park", 10);
    const b = rollInitialLocationNpcs("c1", "park", 10);
    expect(a).toEqual(b);
  });

  it("应返回 1-2 个 NPC", () => {
    const result = rollInitialLocationNpcs("c1", "park", 10);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("不存在的地点应返回空数组", () => {
    expect(rollInitialLocationNpcs("c1", "nonexistent", 10)).toEqual([]);
  });

  it("返回的 NPC 应有 location_npc 类型", () => {
    const result = rollInitialLocationNpcs("c1", "library", 10);
    for (const npc of result) {
      expect(npc.type).toBe("location_npc");
      expect(npc.location).toBe("library");
    }
  });
});

describe("interactLocationNpc", () => {
  const npc: LocationNpc = {
    name: "测试NPC",
    type: "location_npc",
    avatar: "🧑",
    realm: "测试角色",
    intimacy: 50,
    location: "park",
    metAt: 10,
  };

  it("gossip 应增加亲密度 3，不消耗金币", () => {
    const result = interactLocationNpc(npc, "gossip");
    expect(result.intimacyDelta).toBe(3);
    expect(result.goldDelta).toBe(0);
    expect(result.action).toBe("gossip");
  });

  it("gift 应消耗 5 金币，增加亲密度 8", () => {
    const result = interactLocationNpc(npc, "gift");
    expect(result.goldDelta).toBe(-5);
    expect(result.intimacyDelta).toBe(8);
  });

  it("help 应获得 10 金币，增加亲密度 5", () => {
    const result = interactLocationNpc(npc, "help");
    expect(result.goldDelta).toBe(10);
    expect(result.intimacyDelta).toBe(5);
  });
});

describe("isLocationNpc", () => {
  it("应识别合法的 LocationNpc 对象", () => {
    expect(isLocationNpc({ type: "location_npc", name: "a" })).toBe(true);
  });

  it("非对象/非 location_npc 类型应返回 false", () => {
    expect(isLocationNpc(null)).toBe(false);
    expect(isLocationNpc({ type: "neighbor" })).toBe(false);
    expect(isLocationNpc("string")).toBe(false);
  });
});

describe("clampIntimacy", () => {
  it("应在 0-100 范围内", () => {
    expect(clampIntimacy(150)).toBe(100);
    expect(clampIntimacy(-10)).toBe(0);
    expect(clampIntimacy(50)).toBe(50);
  });
});

describe("LOCATION_NPC_ACTION_DEFS", () => {
  it("应包含所有三种互动", () => {
    expect(LOCATION_NPC_ACTION_DEFS.gossip).toBeDefined();
    expect(LOCATION_NPC_ACTION_DEFS.gift).toBeDefined();
    expect(LOCATION_NPC_ACTION_DEFS.help).toBeDefined();
  });
});
