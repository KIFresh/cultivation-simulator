import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatSnapshotForPrompt } from "../narrative-context";
import type { NarrativeStateSnapshot } from "../narrative-context";

// Mock prisma for buildNarrativeSnapshot tests
const mockPrisma = vi.hoisted(() => ({
  familyMember: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock LOCATIONS dynamic import
vi.mock("@/lib/cultivation-data", () => ({
  LOCATIONS: [
    { id: "home", name: "家" },
    { id: "market", name: "坊市" },
    { id: "school", name: "学校" },
  ],
}));

import { buildNarrativeSnapshot, buildFormattedState } from "../narrative-context";

const sampleCultivator = {
  id: "c1",
  userId: "u1",
  name: "测试角色",
  age: 16,
  quarter: 3,
  realm: "练气",
  realmLevel: 2,
  location: "home",
  stamina: 80,
  maxStamina: 100,
  gold: 500,
  health: 90,
  maxAge: 80,
  toxicity: 5,
  attributes: { root: 10, spirit: 8, insight: 6 },
  occupation: "学生",
  schoolRank: 1,
  storyEntries: JSON.stringify([{ title: "测试事件", narrative: "测试剧情", createdAt: "2025-01-01" }]),
};

const sampleSnapshot: NarrativeStateSnapshot = {
  cultivatorId: "c1",
  userId: "u1",
  name: "测试角色",
  age: 16,
  quarter: 3,
  realm: "练气",
  realmLevel: 2,
  location: "家",
  locationId: "home",
  stamina: 80,
  maxStamina: 100,
  gold: 500,
  health: 90,
  maxAge: 80,
  toxicity: 5,
  attributes: { root: 10, spirit: 8, insight: 6 },
  occupation: "学生",
  schoolRank: 1,
  family: [
    { relation: "母亲", name: "王母", age: 40, alive: true, occupation: "教师", livingTogether: true },
  ],
  recentSummary: "测试事件：测试剧情",
};

describe("buildNarrativeSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds snapshot with family members", async () => {
    mockPrisma.familyMember.findMany.mockResolvedValue([
      { relation: "母亲", name: "王母", age: 40, alive: true, occupation: "教师" },
    ]);

    const result = await buildNarrativeSnapshot(sampleCultivator);

    expect(result.cultivatorId).toBe("c1");
    expect(result.name).toBe("测试角色");
    expect(result.age).toBe(16);
    expect(result.quarter).toBe(3);
    expect(result.realm).toBe("练气");
    expect(result.realmLevel).toBe(2);
    expect(result.location).toBe("家");
    expect(result.stamina).toBe(80);
    expect(result.gold).toBe(500);
    expect(result.health).toBe(90);
    expect(result.toxicity).toBe(5);
    expect(result.attributes).toEqual({ root: 10, spirit: 8, insight: 6 });
    expect(result.occupation).toBe("学生");
    expect(result.schoolRank).toBe(1);
    expect(result.family).toHaveLength(1);
    expect(result.family[0].relation).toBe("母亲");
    expect(result.family[0].name).toBe("王母");
    expect(result.recentSummary).toBeTruthy();
  });

  it("handles missing optional fields", async () => {
    mockPrisma.familyMember.findMany.mockResolvedValue([]);

    const result = await buildNarrativeSnapshot({
      id: "c2",
      userId: "u2",
      name: "Test",
      age: 20,
      realm: "凡人",
      location: "home",
    } as any);

    expect(result.stamina).toBe(100); // default
    expect(result.maxStamina).toBe(100); // default
    expect(result.gold).toBe(0); // default
    expect(result.health).toBe(100); // default
    expect(result.toxicity).toBe(0); // default
    expect(result.schoolRank).toBe(0); // default
    expect(result.family).toEqual([]);
    expect(result.recentSummary).toBeUndefined();
  });

  it("handles family load failure gracefully", async () => {
    mockPrisma.familyMember.findMany.mockRejectedValue(new Error("DB error"));

    const result = await buildNarrativeSnapshot(sampleCultivator);
    expect(result.family).toEqual([]);
    expect(result.name).toBe("测试角色"); // other fields still work
  });

  it("handles missing storyEntries gracefully", async () => {
    mockPrisma.familyMember.findMany.mockResolvedValue([]);

    const result = await buildNarrativeSnapshot({
      ...sampleCultivator,
      storyEntries: null,
    } as any);

    expect(result.recentSummary).toBeUndefined();
  });
});

describe("formatSnapshotForPrompt", () => {
  it("formats all fields into a string", () => {
    const result = formatSnapshotForPrompt(sampleSnapshot);

    expect(result).toContain("测试角色");
    expect(result).toContain("16岁");
    expect(result).toContain("第3季");
    expect(result).toContain("练气");
    expect(result).toContain("家");
    expect(result).toContain("80/100");
    expect(result).toContain("500");
    expect(result).toContain("90/80");
    expect(result).toContain("丹毒：5");
    expect(result).toContain("根骨 10");
    expect(result).toContain("灵性 8");
    expect(result).toContain("悟性 6");
    expect(result).toContain("学生");
    expect(result).toContain("重点");
    expect(result).toContain("王母");
    expect(result).toContain("测试事件");
  });

  it("handles empty family", () => {
    const result = formatSnapshotForPrompt({ ...sampleSnapshot, family: [] });
    expect(result).not.toContain("家人：");
  });

  it("filters out deceased family members", () => {
    const snapshot = {
      ...sampleSnapshot,
      family: [
        { relation: "母亲", name: "王母", age: 40, alive: false, livingTogether: true },
        { relation: "父亲", name: "王父", age: 45, alive: true, occupation: "工人", livingTogether: true },
      ],
    };
    const result = formatSnapshotForPrompt(snapshot);
    expect(result).not.toContain("王母");
    expect(result).toContain("王父");
  });

  it("handles realm level text formatting", () => {
    const snapshot = { ...sampleSnapshot, realm: "筑基", realmLevel: 3 };
    const result = formatSnapshotForPrompt(snapshot);
    expect(result).toContain("筑基");
    expect(result).toContain("后期");
  });

  it("includes location constraint", () => {
    const result = formatSnapshotForPrompt(sampleSnapshot);
    expect(result).toContain("当前所在地点");
    expect(result).toContain("家");
  });

  it("handles attributes with empty values", () => {
    const snapshot = { ...sampleSnapshot, attributes: {} };
    const result = formatSnapshotForPrompt(snapshot);
    expect(result).not.toContain("资质：");
  });
});

describe("buildFormattedState", () => {
  it("builds and formats in one call", async () => {
    mockPrisma.familyMember.findMany.mockResolvedValue([]);

    const result = await buildFormattedState(sampleCultivator);
    expect(typeof result).toBe("string");
    expect(result).toContain("测试角色");
    expect(result).toContain("练气");
  });
});