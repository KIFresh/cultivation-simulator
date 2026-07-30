// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDataSync, deriveSkillLevels } from "@/app/dashboard/hooks/use-data-sync";

const mockUseGameStore = vi.fn();

vi.mock("@/store", () => ({
  useGameStore: (selector: (s: unknown) => unknown) => mockUseGameStore(selector),
}));

describe("useDataSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cultivator 为 null 时返回空技能列表", () => {
    mockUseGameStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = { cultivator: null };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => useDataSync());
    expect(result.current.skills).toEqual([]);
    expect(typeof result.current.sync).toBe("function");
  });

  it("根据 attributeExp 派生属性技能等级", () => {
    mockUseGameStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        cultivator: {
          attributeExp: {
            root: { exp: 250, level: 3 },
            spirit: { exp: 80, level: 1 },
          },
          subjectExp: {},
        },
      };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => useDataSync());
    expect(result.current.skills).toHaveLength(2);
    const rootSkill = result.current.skills.find((s) => s.id === "attr_root");
    expect(rootSkill).toBeDefined();
    expect(rootSkill!.name).toBe("根骨");
    expect(rootSkill!.level).toBe(3);
    expect(rootSkill!.exp).toBe(50); // 250 % 100
  });

  it("根据 subjectExp 派生学科技能，按等级降序排列", () => {
    mockUseGameStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        cultivator: {
          attributeExp: {},
          subjectExp: {
            sword: { exp: 320, level: 4 },
            pill: { exp: 50, level: 1 },
          },
        },
      };
      return selector ? selector(state) : state;
    });

    const { result } = renderHook(() => useDataSync());
    expect(result.current.skills).toHaveLength(2);
    // 按等级降序：剑道(4) > 丹道(1)
    expect(result.current.skills[0].id).toBe("subj_sword");
    expect(result.current.skills[0].name).toBe("剑道");
    expect(result.current.skills[0].level).toBe(4);
    expect(result.current.skills[1].id).toBe("subj_pill");
    expect(result.current.skills[1].name).toBe("丹道");
  });
});

describe("deriveSkillLevels", () => {
  it("处理 null/undefined 输入返回空数组", () => {
    expect(deriveSkillLevels(null, null)).toEqual([]);
    expect(deriveSkillLevels(undefined, undefined)).toEqual([]);
  });

  it("处理字符串 JSON 格式的 exp 数据", () => {
    const attrStr = JSON.stringify({ root: { exp: 150, level: 2 } });
    const skills = deriveSkillLevels(attrStr, "{}");
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("根骨");
    expect(skills[0].level).toBe(2);
  });

  it("处理无效字符串时返回空数组", () => {
    const skills = deriveSkillLevels("not-json{{", null);
    expect(skills).toEqual([]);
  });
});
